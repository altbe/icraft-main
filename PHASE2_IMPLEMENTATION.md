# Phase 2: Query Embeddings Implementation

## Objective
Enable real-time query embedding generation for semantic vector search in the image library.

## Current State
- ✅ Database has 1,196 BGE-M3 embeddings (1024-dim vectors)
- ✅ `search_custom_images_vector` function ready with `p_use_vector` parameter
- ✅ IVFFlat index created on embedding column
- ❌ Query embeddings not generated (p_use_vector=false)
- ❌ No embedding endpoint in API

## Implementation Steps

### 1. Enable Cloudflare Workers AI in Zuplo

Add to Zuplo configuration:
```typescript
// zuplo.runtime.ts
export interface ZuploEnvironment extends BaseEnvironment {
  AI: any; // Cloudflare Workers AI binding
}
```

### 2. Create Embedding Module

```typescript
// backend/modules/icraft-embeddings.ts
import { ZuploContext, ZuploRequest, HttpProblems } from "@zuplo/runtime";

export async function generateQueryEmbedding(
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return HttpProblems.badRequest(request, context, {
        detail: "Query string is required"
      });
    }
    
    // Generate embedding using BGE-M3
    const embeddingResponse = await context.env.AI.run(
      '@cf/baai/bge-m3',
      {
        text: [query.slice(0, 512)] // BGE-M3 max input length
      }
    );
    
    if (!embeddingResponse?.data?.[0]) {
      throw new Error('Failed to generate embedding');
    }
    
    return new Response(JSON.stringify({ 
      embedding: embeddingResponse.data[0], // 1024-dim vector
      query: query,
      model: 'bge-m3',
      dimensions: 1024
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5-minute cache
      }
    });
  } catch (error) {
    context.log.error('Embedding generation failed', { error });
    
    // Return null embedding to fallback to text search
    return new Response(JSON.stringify({ 
      embedding: null,
      query: request.body.query,
      model: 'none',
      error: 'Embedding generation failed'
    }), {
      status: 200, // Still 200 to allow fallback
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 3. Update Search Function

```typescript
// backend/modules/icraft-images.ts - Update searchProprietaryImages function
async function searchProprietaryImages(
  query: string,
  page: number,
  perPage: number,
  context: ZuploContext,
  language: string = 'en'
): Promise<ImageSearchResponse> {
  try {
    let queryEmbedding = null;
    
    // Generate embedding for semantic search
    if (query && query.trim().length > 0) {
      try {
        const embeddingResponse = await context.env.AI.run(
          '@cf/baai/bge-m3',
          { text: [query] }
        );
        queryEmbedding = embeddingResponse.data?.[0];
      } catch (error) {
        context.log.warn('Failed to generate query embedding, falling back to text search', { error });
      }
    }
    
    // Call stored procedure with or without embedding
    const { data, error } = await supabase.rpc('search_custom_images_vector', {
      p_query: query || '',
      p_language: language,
      p_category_id: null,
      p_page: page,
      p_per_page: perPage,
      p_order_by: 'relevance',
      p_use_vector: !!queryEmbedding, // Enable vector search if embedding available
      p_query_embedding: queryEmbedding, // Pass the embedding
      p_vector_threshold: 0.3
    });
    
    if (error) {
      context.log.error('Search failed', { error });
      return { images: [], total: 0, page };
    }
    
    const totalCount = data && data.length > 0 ? data[0].total_count : 0;
    
    return {
      images: (data || []).map(img => ({
        url: img.image_url,
        provider: 'custom',
        metadata: {
          id: img.image_id,
          title: img.title,
          description: img.description,
          category: img.category_name,
          category_id: img.category_id,
          tags: img.tags,
          width: img.width,
          height: img.height,
          relevance_score: img.relevance_score
        }
      })),
      total: totalCount,
      page
    };
  } catch (error) {
    context.log.error('Error searching custom images', { error });
    return { images: [], total: 0, page };
  }
}
```

### 4. Update Database Function

```sql
-- Update search_custom_images_vector to accept query embedding
DROP FUNCTION IF EXISTS search_custom_images_vector;

CREATE OR REPLACE FUNCTION search_custom_images_vector(
  p_query TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'en',
  p_category_id TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 20,
  p_order_by TEXT DEFAULT 'relevance',
  p_use_vector BOOLEAN DEFAULT false,
  p_query_embedding vector(1024) DEFAULT NULL, -- NEW PARAMETER
  p_vector_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  image_id UUID,
  image_url TEXT,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  category_id TEXT,
  category_name TEXT,
  tags TEXT[],
  width INTEGER,
  height INTEGER,
  relevance_score REAL,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset INTEGER;
  v_search_query tsquery;
  v_language_config regconfig;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  
  -- Set language config for full-text search
  v_language_config := CASE p_language
    WHEN 'es' THEN 'spanish'::regconfig
    ELSE 'english'::regconfig
  END;
  
  -- Prepare search query for text search
  IF p_query IS NOT NULL AND p_query != '' THEN
    v_search_query := plainto_tsquery(v_language_config, p_query);
  END IF;
  
  -- Vector search when embedding is provided
  IF p_use_vector AND p_query_embedding IS NOT NULL THEN
    RETURN QUERY
    WITH vector_results AS (
      SELECT 
        ci.id,
        ci.url,
        ci.thumbnail_url,
        COALESCE(cit.title, cit_en.title, 'Untitled') AS title,
        COALESCE(cit.description, cit_en.description, '') AS description,
        ci.category,
        COALESCE(cat_t.name, cat_t_en.name, 'Uncategorized') AS category_name,
        COALESCE(cit.tags, cit_en.tags, ARRAY[]::TEXT[]) AS tags,
        ci.width,
        ci.height,
        1 - (ci.embedding <=> p_query_embedding) AS similarity_score,
        COUNT(*) OVER() AS total
      FROM custom_images ci
      LEFT JOIN custom_images_translations cit 
        ON ci.id = cit.image_id AND cit.language_code = p_language
      LEFT JOIN custom_images_translations cit_en 
        ON ci.id = cit_en.image_id AND cit_en.language_code = 'en'
      LEFT JOIN categories_translations cat_t
        ON ci.category = cat_t.category_id AND cat_t.language_code = p_language
      LEFT JOIN categories_translations cat_t_en
        ON ci.category = cat_t_en.category_id AND cat_t_en.language_code = 'en'
      WHERE 
        ci.is_active = true
        AND ci.is_safe = true
        AND ci.embedding IS NOT NULL
        AND (p_category_id IS NULL OR ci.category = p_category_id)
        AND 1 - (ci.embedding <=> p_query_embedding) > p_vector_threshold
    )
    SELECT 
      id AS image_id,
      url AS image_url,
      thumbnail_url,
      title,
      description,
      category AS category_id,
      category_name,
      tags,
      width,
      height,
      similarity_score::REAL AS relevance_score,
      total::BIGINT AS total_count
    FROM vector_results
    ORDER BY similarity_score DESC
    LIMIT p_per_page
    OFFSET v_offset;
  ELSE
    -- Fallback to text search (existing logic)
    RETURN QUERY
    WITH text_results AS (
      SELECT 
        ci.id,
        ci.url,
        ci.thumbnail_url,
        COALESCE(cit.title, cit_en.title, 'Untitled') AS title,
        COALESCE(cit.description, cit_en.description, '') AS description,
        ci.category,
        COALESCE(cat_t.name, cat_t_en.name, 'Uncategorized') AS category_name,
        COALESCE(cit.tags, cit_en.tags, ARRAY[]::TEXT[]) AS tags,
        ci.width,
        ci.height,
        CASE 
          WHEN p_query IS NULL OR p_query = '' THEN 0
          ELSE COALESCE(
            ts_rank(cit.search_vector, v_search_query),
            ts_rank(cit_en.search_vector, plainto_tsquery('english', p_query)),
            0
          )
        END AS rank,
        COUNT(*) OVER() AS total
      FROM custom_images ci
      LEFT JOIN custom_images_translations cit 
        ON ci.id = cit.image_id AND cit.language_code = p_language
      LEFT JOIN custom_images_translations cit_en 
        ON ci.id = cit_en.image_id AND cit_en.language_code = 'en'
      LEFT JOIN categories_translations cat_t
        ON ci.category = cat_t.category_id AND cat_t.language_code = p_language
      LEFT JOIN categories_translations cat_t_en
        ON ci.category = cat_t_en.category_id AND cat_t_en.language_code = 'en'
      WHERE 
        ci.is_active = true
        AND ci.is_safe = true
        AND (p_category_id IS NULL OR ci.category = p_category_id)
        AND (p_query IS NULL OR p_query = '' OR 
             cit.search_vector @@ v_search_query OR
             cit_en.search_vector @@ plainto_tsquery('english', p_query))
    )
    SELECT 
      id AS image_id,
      url AS image_url,
      thumbnail_url,
      title,
      description,
      category AS category_id,
      category_name,
      tags,
      width,
      height,
      rank::REAL AS relevance_score,
      total::BIGINT AS total_count
    FROM text_results
    ORDER BY 
      CASE p_order_by
        WHEN 'latest' THEN id DESC
        ELSE rank DESC
      END
    LIMIT p_per_page
    OFFSET v_offset;
  END IF;
END;
$$;
```

### 5. Add API Route

```json
// config/routes.oas.json - Add new route
{
  "paths": {
    "/v1/embeddings": {
      "post": {
        "operationId": "generate-query-embedding",
        "x-zuplo-route": {
          "handler": {
            "export": "generateQueryEmbedding",
            "module": "$import(./modules/icraft-embeddings)"
          }
        },
        "summary": "Generate query embedding for semantic search",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "query": {
                    "type": "string",
                    "description": "Search query to generate embedding for"
                  }
                },
                "required": ["query"]
              }
            }
          }
        }
      }
    }
  }
}
```

## Testing Queries

```javascript
// Test multilingual semantic search
const testQueries = [
  { query: "angry child", lang: "en" },
  { query: "niño enojado", lang: "es" },
  { query: "children playing", lang: "en" },
  { query: "niños jugando", lang: "es" },
  { query: "school classroom", lang: "en" },
  { query: "aula escolar", lang: "es" }
];

for (const test of testQueries) {
  const response = await fetch(`/v1/images/search?query=${test.query}&lang=${test.lang}`);
  const results = await response.json();
  console.log(`Query: "${test.query}" (${test.lang}) - Found: ${results.total} images`);
}
```

## Deployment Sequence

1. **Deploy database function** to non-prod
2. **Configure Cloudflare AI** in Zuplo dev environment
3. **Deploy embedding module** and test endpoint
4. **Update search function** to use embeddings
5. **Test with sample queries** in both languages
6. **Deploy to production** with feature flag

## Next Phase Preview

After Phase 2 is complete, Phase 3 will focus on:
- Frontend language toggle component
- Client-side result caching
- Offline support with IndexedDB
- Search history and suggestions