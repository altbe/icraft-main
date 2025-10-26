# Image Search Enhancements - Implementation Plan

## Overview
This document outlines the complete implementation plan for unifying and enhancing the image search experience across iCraftStories, supporting both Pixabay stock images and custom proprietary images with bilingual support (English/Spanish).

## Current State Analysis

### ✅ Phase 1: Database Foundation - COMPLETED
1. **Database Schema**: All tables deployed to both prod and non-prod environments
   - `custom_images` table with BGE-M3 embedding column (vector(1024))
   - `custom_images_translations` with full-text search support
   - `categories` and `categories_translations` tables for i18n
   - pgvector extension with IVFFlat indexes
2. **Data Migration**: Successfully deployed
   - 1,196 BGE-M3 embeddings generated and stored
   - 2,392 translations (1,196 English + 1,196 Spanish)
   - 20 categories with full i18n support (added 8 missing categories)
   - All referential integrity constraints satisfied
3. **Stored Procedures**: Deployed to both environments
   - `search_custom_images_vector` - Enhanced search with vector support (AI-powered search ACTIVE)
   - `get_featured_images_i18n` - Category samples with translations
   - Dropped legacy `search_custom_images` function
4. **API Integration**: Backend fully updated
   - `icraft-images.ts` using new `search_custom_images_vector` function with embeddings
   - Language parameter extraction from query string
   - Removed deprecated `icraft-custom-images.ts` module
5. **Processing Scripts**: Created and tested
   - `generate-bge-m3-embeddings.py` - Generates BGE-M3 embeddings
   - `deploy-jsonl-to-supabase.py` - Deploys embeddings to both databases
   - `deploy-translations.py` - Deploys i18n translations
   - `process-pipeline.sh` - Orchestrator for complete pipeline

### ✅ Phase 2: Query Embeddings - COMPLETED
1. **Query Embedding Generation**: Fully implemented
   - BGE-M3 embeddings generated via `icraft-embeddings.ts` module
   - Real-time generation in Zuplo gateway with Cloudflare Workers AI
   - Fallback to text search if embedding generation fails
2. **Vector Search Activation**: Active and operational
   - Database has IVFFlat index on embedding column
   - Search function uses vector similarity when embeddings provided
   - Cosine similarity threshold configured at 0.3
   - Multilingual semantic search working (English/Spanish)

### 📊 Phase 1 & 2 Monitoring (September-October 2025)

**Deployment Status**: ✅ All components deployed and operational

#### What's Deployed
- ✅ **1,196 BGE-M3 embeddings** deployed to both prod and non-prod environments
- ✅ **2,392 translations** (1,196 English + 1,196 Spanish) with full-text search
- ✅ **20 categories** with bilingual i18n support
- ✅ **Vector search function** `search_custom_images_vector()` active in production
- ✅ **Real-time query embeddings** via Cloudflare Workers AI (@cf/baai/bge-m3)
- ✅ **IVFFlat indexes** on embedding column for fast similarity search
- ✅ **Fallback mechanism** to text search when embedding generation fails

#### Cost Analysis
- **Estimated monthly cost**: ~$0.03 for 3,000 searches
- **78% savings** vs. GPT-4o-mini embedding approach
- **Cloudflare Workers AI**: Free tier covers most usage

#### Performance Targets (To Be Measured)
- [ ] **Search Latency**: Target 400-600ms total (embedding + database query)
- [ ] **Embedding Success Rate**: Target >95% successful generations
- [ ] **Vector vs. Text Search**: Compare result relevance and user engagement
- [ ] **Multilingual Performance**: Measure English vs. Spanish result quality
- [ ] **Fallback Frequency**: Track how often text search fallback is used

#### Monitoring Actions Needed
- [ ] **Set up logging**: Track embedding generation success/failure rates
- [ ] **Performance metrics**: Log search latency for vector vs. text searches
- [ ] **User behavior**: Analyze search patterns and query types
- [ ] **Cost tracking**: Monitor Cloudflare Workers AI usage and costs
- [ ] **Quality assessment**: Collect user feedback on search result relevance

#### Known Issues & Optimizations
- **Similarity Threshold**: Currently 0.3 - may need tuning based on user feedback
- **Index Tuning**: IVFFlat index performance depends on list count (currently default)
- **Embedding Cache**: Consider caching frequent queries to reduce API calls
- **Result Ranking**: Pure cosine similarity - could combine with text search scores

#### Next Review Date
**December 2025** - Quarterly review of metrics and optimization opportunities

#### Success Criteria
- ✅ **Technical Deployment**: All components deployed and operational
- ⏳ **Performance**: Measure against 400-600ms latency target
- ⏳ **Quality**: User satisfaction with semantic search results
- ⏳ **Cost**: Stay within $0.05/month budget
- ⏳ **Adoption**: Track usage patterns and feature adoption

### 📋 Remaining Tasks
- **Phase 3**: Frontend service layer enhancements
- **Phase 4**: UI components refinements
- **Phase 5**: Additional i18n translation coverage
- **Phase 6**: CDN optimization with Cloudflare Workers

### Technical Constraints
- **Pixabay API**: 100 requests/60 seconds rate limit, safesearch enabled
- **R2 Storage**: Custom images hosted on Cloudflare R2 (img.icraftstories.com)
- **Language Support**: English and Spanish implemented in backend
- **PWA Requirements**: Must work offline with cached content

## Architecture Design

### Data Flow Architecture
```
User Interface (React + i18n)
    ↓
Service Layer (Caching + Rate Limiting)
    ↓
API Gateway (Zuplo)
    ↓
Query Enhancement (GPT-4o-mini)
    ↓
Parallel Search
    ├── Pixabay API (External)
    └── Supabase (Custom Images)
        ├── Full-text Search (single words)
        └── Vector Search (multi-word queries)
    ↓
Unified Response
    ↓
CDN (Cloudflare R2)
```

### Vector Embedding Strategy
- **Model**: @cf/baai/bge-m3 (multilingual, 100+ languages)
- **Dimension**: 1024 (dense embeddings)
- **Generation**: 
  - Offline: Batch process image metadata locally with BGE-M3
  - Online: Real-time query embeddings via Cloudflare Workers AI
- **Storage**: pgvector extension in PostgreSQL
- **Search**: Semantic vector search for ALL queries (better for social stories)
- **Cost**: ~$0.03/month for 3,000 searches

## Phase 1: Database Layer

### 1.1 Schema Design - Enhanced with Vector Embeddings

```sql
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Main images table (language-agnostic) - EXISTS, needs ALTER for embedding
CREATE TABLE custom_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- R2 Storage
  r2_key TEXT NOT NULL UNIQUE,  -- Now with unique constraint
  url TEXT NOT NULL, -- https://img.icraftstories.com/...
  thumbnail_url TEXT,
  
  -- Foreign key to categories table (not inline)
  category_id TEXT REFERENCES categories(id),
  
  -- Properties
  width INTEGER,
  height INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_safe BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add embedding column to existing table (BGE-M3 dimensions)
ALTER TABLE custom_images 
ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Categories master table - ALREADY EXISTS as custom_images_categories
-- Updated with social story categories: routines, emotions, social, etc.
CREATE TABLE custom_images_categories (
  id TEXT PRIMARY KEY,  -- 'routines', 'emotions', 'social', etc.
  icon TEXT,            -- Icon identifier for UI
  sort_order INTEGER,   -- Display order
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category translations - ALREADY EXISTS as custom_images_categories_translations
CREATE TABLE custom_images_categories_translations (
  category_id TEXT NOT NULL REFERENCES custom_images_categories(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'es')),
  name TEXT NOT NULL,        -- 'Nature' (en), 'Naturaleza' (es)
  description TEXT,          -- Optional category description
  
  PRIMARY KEY (category_id, language_code)
);

-- Image translations table
CREATE TABLE custom_images_translations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES custom_images(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'es')),
  
  -- Localized content
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  
  -- Full-text search vector (auto-generated)
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector(
      CASE language_code
        WHEN 'es' THEN 'spanish'::regconfig
        ELSE 'english'::regconfig
      END, 
      coalesce(title, '')
    ), 'A') ||
    setweight(to_tsvector(
      CASE language_code
        WHEN 'es' THEN 'spanish'::regconfig
        ELSE 'english'::regconfig
      END,
      coalesce(description, '')
    ), 'B') ||
    setweight(to_tsvector(
      CASE language_code
        WHEN 'es' THEN 'spanish'::regconfig
        ELSE 'english'::regconfig
      END,
      coalesce(array_to_string(tags, ' '), '')
    ), 'C')
  ) STORED,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(image_id, language_code)
);


-- Indexes for performance
CREATE INDEX idx_custom_images_category ON custom_images(category_id) WHERE is_active = true;
CREATE INDEX idx_custom_images_created ON custom_images(created_at DESC) WHERE is_active = true;
CREATE INDEX idx_translations_search ON custom_images_translations USING GIN(search_vector);
CREATE INDEX idx_translations_lang ON custom_images_translations(language_code);

-- Vector similarity index for semantic search (BGE-M3)
CREATE INDEX idx_custom_images_embedding ON custom_images 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 35); -- sqrt(1196) ≈ 35 for optimal performance
```

### 1.2 Search Functions

```sql
-- Main search function with i18n support and category translations
CREATE OR REPLACE FUNCTION search_custom_images_i18n(
  p_query TEXT DEFAULT '',
  p_language TEXT DEFAULT 'en',
  p_category_id TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 24,
  p_order_by TEXT DEFAULT 'relevance'
) 
RETURNS TABLE (
  id UUID,
  url TEXT,
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
  
  -- Prepare search query
  IF p_query != '' THEN
    v_search_query := plainto_tsquery(v_language_config, p_query);
  END IF;
  
  RETURN QUERY
  WITH filtered_images AS (
    SELECT 
      ci.id,
      ci.url,
      ci.thumbnail_url,
      COALESCE(cit.title, cit_en.title, 'Untitled') AS title,
      COALESCE(cit.description, cit_en.description, '') AS description,
      ci.category_id,
      COALESCE(cat_t.name, cat_t_en.name, 'Uncategorized') AS category_name,
      COALESCE(cit.tags, cit_en.tags, ARRAY[]::TEXT[]) AS tags,
      ci.width,
      ci.height,
      CASE 
        WHEN p_query = '' THEN 0
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
      ON ci.category_id = cat_t.category_id AND cat_t.language_code = p_language
    LEFT JOIN categories_translations cat_t_en
      ON ci.category_id = cat_t_en.category_id AND cat_t_en.language_code = 'en'
    WHERE 
      ci.is_active = true
      AND ci.is_safe = true
      AND (p_category_id IS NULL OR ci.category_id = p_category_id)
      AND (p_query = '' OR 
           cit.search_vector @@ v_search_query OR
           cit_en.search_vector @@ plainto_tsquery('english', p_query))
  )
  SELECT * FROM filtered_images
  ORDER BY 
    CASE p_order_by
      WHEN 'latest' THEN ci.created_at DESC
      WHEN 'relevance' THEN rank DESC
      ELSE rank DESC
    END
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;

-- CURRENT: Enhanced search function with vector similarity support
-- Status: IMPLEMENTED in both prod and non-prod as search_custom_images_vector
-- Note: Vector search currently disabled, awaiting query embedding generation
CREATE OR REPLACE FUNCTION search_custom_images_vector(
  p_query TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'en',
  p_category_id TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 20,
  p_order_by TEXT DEFAULT 'relevance',
  p_use_vector BOOLEAN DEFAULT false,
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
  v_similarity_threshold FLOAT := 0.3; -- Lower threshold for better recall
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  
  RETURN QUERY
  WITH filtered_images AS (
    SELECT 
      ci.id,
      ci.url,
      ci.thumbnail_url,
      COALESCE(cit.title, cit_en.title, 'Untitled') AS title,
      COALESCE(cit.description, cit_en.description, '') AS description,
      ci.category_id,
      COALESCE(cat_t.name, cat_t_en.name, 'Uncategorized') AS category_name,
      COALESCE(cit.tags, cit_en.tags, ARRAY[]::TEXT[]) AS tags,
      ci.width,
      ci.height,
      CASE 
        WHEN p_query = '' OR p_query_embedding IS NULL THEN 0
        ELSE
          -- Vector similarity score (cosine similarity, higher is better)
          1 - (ci.embedding <=> p_query_embedding)
      END AS rank,
      COUNT(*) OVER() AS total
    FROM custom_images ci
    LEFT JOIN custom_images_translations cit 
      ON ci.id = cit.image_id AND cit.language_code = p_language
    LEFT JOIN custom_images_translations cit_en 
      ON ci.id = cit_en.image_id AND cit_en.language_code = 'en'
    LEFT JOIN custom_images_categories_translations cat_t
      ON ci.category_id = cat_t.category_id AND cat_t.language_code = p_language
    LEFT JOIN custom_images_categories_translations cat_t_en
      ON ci.category_id = cat_t_en.category_id AND cat_t_en.language_code = 'en'
    WHERE 
      ci.is_active = true
      AND ci.is_safe = true
      AND (p_category_id IS NULL OR ci.category_id = p_category_id)
      AND (
        p_query = '' OR
        p_query_embedding IS NULL OR
        -- Semantic search with embeddings (always used when embedding provided)
        (ci.embedding IS NOT NULL AND
         (ci.embedding <=> p_query_embedding) < v_similarity_threshold)
      )
  )
  SELECT * FROM filtered_images
  ORDER BY rank DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;

-- Get localized categories
CREATE OR REPLACE FUNCTION get_categories_i18n(
  p_language TEXT DEFAULT 'en'
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER,
  image_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    COALESCE(ct.name, ct_en.name, c.id) AS name,
    COALESCE(ct.description, ct_en.description, '') AS description,
    c.icon,
    c.sort_order,
    COUNT(DISTINCT ci.id) AS image_count
  FROM categories c
  LEFT JOIN categories_translations ct
    ON c.id = ct.category_id AND ct.language_code = p_language
  LEFT JOIN categories_translations ct_en
    ON c.id = ct_en.category_id AND ct_en.language_code = 'en'
  LEFT JOIN custom_images ci
    ON c.id = ci.category_id AND ci.is_active = true
  WHERE c.is_active = true
  GROUP BY c.id, ct.name, ct_en.name, ct.description, ct_en.description, c.icon, c.sort_order
  ORDER BY c.sort_order, ct.name;
END;
$$;

-- Get sample images by category for discovery
CREATE OR REPLACE FUNCTION get_category_samples_i18n(
  p_language TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 4
)
RETURNS TABLE (
  category_id TEXT,
  category_name TEXT,
  images JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH category_images AS (
    SELECT 
      c.id AS category_id,
      COALESCE(ct.name, ct_en.name, c.id) AS category_name,
      ci.id AS image_id,
      ci.url,
      ci.thumbnail_url,
      COALESCE(cit.title, cit_en.title, 'Untitled') AS image_title,
      ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY ci.created_at DESC) AS rn
    FROM categories c
    INNER JOIN custom_images ci ON c.id = ci.category_id
    LEFT JOIN categories_translations ct
      ON c.id = ct.category_id AND ct.language_code = p_language
    LEFT JOIN categories_translations ct_en
      ON c.id = ct_en.category_id AND ct_en.language_code = 'en'
    LEFT JOIN custom_images_translations cit
      ON ci.id = cit.image_id AND cit.language_code = p_language
    LEFT JOIN custom_images_translations cit_en
      ON ci.id = cit_en.image_id AND cit_en.language_code = 'en'
    WHERE c.is_active = true
      AND ci.is_active = true
      AND ci.is_safe = true
  )
  SELECT 
    category_id,
    category_name,
    jsonb_agg(
      jsonb_build_object(
        'id', image_id,
        'title', image_title,
        'url', url,
        'thumbnail_url', thumbnail_url
      ) ORDER BY rn
    ) AS images
  FROM category_images
  WHERE rn <= p_limit
  GROUP BY category_id, category_name
  ORDER BY category_id;
END;
$$;
```

### 1.3 Data Migration Strategy

#### Step 1: Create Categories Structure

```sql
-- Create categories master table
INSERT INTO categories (id, icon, sort_order) VALUES
  ('people', 'users', 1),
  ('animals', 'paw', 2),
  ('nature', 'leaf', 3),
  ('school', 'graduation-cap', 4),
  ('sports', 'futbol', 5),
  ('food', 'utensils', 6),
  ('home', 'home', 7),
  ('health', 'heart', 8),
  ('transportation', 'car', 9),
  ('feelings', 'smile', 10),
  ('backgrounds', 'image', 11);

-- Add English category translations
INSERT INTO categories_translations (category_id, language_code, name, description) VALUES
  ('people', 'en', 'People', 'Images of people and characters'),
  ('animals', 'en', 'Animals', 'Pets and wildlife'),
  ('nature', 'en', 'Nature', 'Outdoor scenes and plants'),
  ('school', 'en', 'School', 'Education and learning'),
  ('sports', 'en', 'Sports', 'Sports and activities'),
  ('food', 'en', 'Food', 'Food and drinks'),
  ('home', 'en', 'Home', 'Home and furniture'),
  ('health', 'en', 'Health', 'Health and wellness'),
  ('transportation', 'en', 'Transportation', 'Vehicles and travel'),
  ('feelings', 'en', 'Feelings', 'Emotions and expressions'),
  ('backgrounds', 'en', 'Backgrounds', 'Background images');

-- Add Spanish category translations
INSERT INTO categories_translations (category_id, language_code, name, description) VALUES
  ('people', 'es', 'Personas', 'Imágenes de personas y personajes'),
  ('animals', 'es', 'Animales', 'Mascotas y vida silvestre'),
  ('nature', 'es', 'Naturaleza', 'Escenas al aire libre y plantas'),
  ('school', 'es', 'Escuela', 'Educación y aprendizaje'),
  ('sports', 'es', 'Deportes', 'Deportes y actividades'),
  ('food', 'es', 'Comida', 'Comida y bebidas'),
  ('home', 'es', 'Hogar', 'Hogar y muebles'),
  ('health', 'es', 'Salud', 'Salud y bienestar'),
  ('transportation', 'es', 'Transporte', 'Vehículos y viajes'),
  ('feelings', 'es', 'Sentimientos', 'Emociones y expresiones'),
  ('backgrounds', 'es', 'Fondos', 'Imágenes de fondo');

-- Update existing images to use category_id
ALTER TABLE custom_images ADD COLUMN category_id TEXT REFERENCES categories(id);
UPDATE custom_images SET category_id = category WHERE category IS NOT NULL;
```

#### Step 2: Generate English Translations from Filenames

```sql
-- Function to generate title from filename
CREATE OR REPLACE FUNCTION generate_english_title(p_r2_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_filename TEXT;
  v_title TEXT;
BEGIN
  -- Extract filename from path
  v_filename := regexp_replace(p_r2_key, '^.+/', '');
  -- Remove extension
  v_filename := regexp_replace(v_filename, '\.\w+$', '');
  -- Replace hyphens and underscores with spaces
  v_title := replace(replace(v_filename, '-', ' '), '_', ' ');
  -- Remove trailing numbers
  v_title := regexp_replace(v_title, '\s+\d+$', '');
  -- Title case
  v_title := initcap(v_title);
  
  RETURN trim(v_title);
END;
$$;

-- Populate English translations
INSERT INTO custom_images_translations (image_id, language_code, title, tags)
SELECT 
  id,
  'en',
  generate_english_title(r2_key),
  string_to_array(lower(generate_english_title(r2_key)), ' ')
FROM custom_images
ON CONFLICT (image_id, language_code) DO UPDATE
SET 
  title = EXCLUDED.title,
  tags = EXCLUDED.tags,
  updated_at = NOW();
```

#### Step 3: Generate Spanish Translations

```javascript
// Simple batch translation script
async function generateSpanishTranslations() {
  const { data: englishData } = await supabase
    .from('custom_images_translations')
    .select('image_id, title, tags')
    .eq('language_code', 'en');
  
  const batchSize = 50;
  for (let i = 0; i < englishData.length; i += batchSize) {
    const batch = englishData.slice(i, i + batchSize);
    
    const prompt = `
      Translate these image titles and tags from English to Spanish.
      Keep translations simple and appropriate for children.
      
      Format: JSON array
      Input: ${JSON.stringify(batch)}
    `;
    
    const translations = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    
    // Insert translations
    for (const trans of JSON.parse(translations.choices[0].message.content)) {
      await supabase
        .from('custom_images_translations')
        .upsert({
          image_id: trans.image_id,
          language_code: 'es',
          title: trans.title,
          tags: trans.tags
        });
    }
  }
}
```

## Phase 2: Backend API Layer

### 2.1 API Endpoints

```typescript
// backend/modules/icraft-images.ts

// Main search endpoint with i18n
export async function searchImages(request: ZuploRequest, context: ZuploContext) {
  const params = new URL(request.url).searchParams;
  
  const query = sanitizeString(params.get('query') || '', 100);
  const language = params.get('lang') || 'en';
  const provider = params.get('provider') || 'all';
  const page = parseInt(params.get('page') || '1', 10);
  const perPage = Math.min(parseInt(params.get('perPage') || '24', 10), 200);
  const category = params.get('category');
  const orderBy = params.get('orderBy') || 'popular';
  
  // Rate limiting check
  if (!checkRateLimit(context)) {
    return HttpProblems.tooManyRequests(request, context);
  }
  
  let results = { images: [], total: 0, page };
  
  // Parallel search
  if (provider === 'pixabay' || provider === 'all') {
    const pixabayResults = await searchPixabay(query, page, perPage, language);
    results.images.push(...pixabayResults.images);
    results.total += pixabayResults.total;
  }
  
  if (provider === 'custom' || provider === 'all') {
    const customResults = await searchCustomImagesI18n(
      query, language, page, perPage, category, orderBy
    );
    results.images.push(...customResults.images);
    results.total += customResults.total;
  }
  
  return new Response(JSON.stringify(results), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Vary': 'Accept-Language'
    }
  });
}

// Generate query embeddings using BGE-M3 for multilingual semantic search
export async function generateQueryEmbedding(request: ZuploRequest, context: ZuploContext) {
  const { query } = await request.json();
  
  if (!query) {
    return HttpProblems.badRequest(request, context, { detail: 'Query required' });
  }
  
  try {
    // Generate embedding using BGE-M3 via Cloudflare Workers AI
    // BGE-M3 handles 100+ languages automatically - no language param needed
    // It understands semantic relationships: "angry" ≈ "upset" ≈ "enojado"
    const embeddingResponse = await env.AI.run(
      '@cf/baai/bge-m3',
      {
        text: [query], // BGE-M3 accepts array of texts
      }
    );
    
    return new Response(JSON.stringify({ 
      embedding: embeddingResponse.data[0], // 1024-dim vector from BGE-M3
      query: query,
      model: 'bge-m3'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 min
      }
    });
  } catch (error) {
    context.log.error('Embedding generation failed', { error });
    // Fallback to category browsing without embedding
    return new Response(JSON.stringify({ 
      embedding: null,
      query: query,
      model: 'none'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Featured images endpoint
export async function getFeaturedImages(request: ZuploRequest, context: ZuploContext) {
  const language = new URL(request.url).searchParams.get('lang') || 'en';
  
  const { data, error } = await supabase.rpc('get_featured_images_i18n', {
    p_language: language,
    p_limit: 4
  });
  
  if (error) {
    return HttpProblems.internalServerError(request, context);
  }
  
  return new Response(JSON.stringify({ categories: data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
      'Vary': 'Accept-Language'
    }
  });
}
```

## Phase 3: Frontend Implementation

### 3.1 Service Layer

```typescript
// frontend/src/services/ImageProxyService.ts

class ImageCache {
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  getCacheKey(options: SearchOptions): string {
    const { language, ...rest } = options;
    return `${language}_${JSON.stringify(rest)}`;
  }

  get(options: SearchOptions): SearchResponse | null {
    const key = this.getCacheKey(options);
    const cached = this.cache.get(key);
    
    if (!cached || Date.now() - cached.timestamp > this.TTL) {
      return null;
    }
    
    return cached.data;
  }

  set(options: SearchOptions, data: SearchResponse): void {
    const key = this.getCacheKey(options);
    this.cache.set(key, { data, timestamp: Date.now() });
    this.saveToLocalStorage();
  }
}

export class ImageProxyService {
  private static cache = new ImageCache();
  private static requestCount = 0;
  private static resetTimer: NodeJS.Timeout | null = null;

  static async searchImages(options: SearchOptions): Promise<SearchResponse> {
    const language = options.language || localStorage.getItem('i18nextLng') || 'en';
    const searchOptions = { ...options, language };
    
    // Check cache
    const cached = this.cache.get(searchOptions);
    if (cached) return cached;
    
    // Check rate limit
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit reached. Please wait.');
    }
    
    const params = new URLSearchParams({
      provider: searchOptions.provider || 'all',
      query: searchOptions.query,
      lang: language,
      page: String(searchOptions.page || 1),
      perPage: String(searchOptions.perPage || 24),
      ...(searchOptions.category && { category: searchOptions.category }),
      ...(searchOptions.orderBy && { orderBy: searchOptions.orderBy })
    });
    
    const response = await apiClient.get(`/v1/images/search?${params}`);
    const result = {
      images: response.data.images || [],
      total: response.data.total || 0,
      page: response.data.page || 1,
      hasMore: response.data.images?.length === searchOptions.perPage
    };
    
    this.cache.set(searchOptions, result);
    return result;
  }
}
```

### 3.2 UI Components Structure

```typescript
// frontend/src/components/ImageSearch.tsx

const UnifiedImageSearch: React.FC = ({ onSelect, onClose }) => {
  const { t, i18n } = useTranslation(['canvas', 'imageSearch']);
  const [state, setState] = useState<ImageSearchState>({
    query: '',
    language: i18n.language as 'en' | 'es',
    provider: 'library',
    category: undefined,
    orderBy: 'popular',
    page: 1,
    images: [],
    total: 0,
    isLoading: false,
    hasSearched: false,
    isThrottled: false,
    remainingRequests: 100
  });

  // Effect to handle language changes
  useEffect(() => {
    if (i18n.language !== state.language) {
      setState(prev => ({ ...prev, language: i18n.language as 'en' | 'es' }));
      ImageProxyService.clearCacheForLanguage(state.language);
    }
  }, [i18n.language]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <ImageSearchHeader
          onClose={onClose}
          isThrottled={state.isThrottled}
          remainingRequests={state.remainingRequests}
        />
        
        {/* Tabs */}
        <Tabs value={state.provider} onValueChange={handleProviderChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library">
              {t('imageSearch.tabs.library')}
            </TabsTrigger>
            <TabsTrigger value="pixabay">
              {t('imageSearch.tabs.pixabay')}
            </TabsTrigger>
          </TabsList>
          
          {/* Search Bar */}
          <div className="p-4 border-b">
            <UnifiedSearchBar
              value={state.query}
              onChange={handleQueryChange}
              onSearch={handleSearch}
              placeholder={t(`imageSearch.placeholder.${state.provider}`)}
              isLoading={state.isLoading}
            />
            
            {/* Category Pills */}
            <CategoryPills
              selected={state.category}
              onSelect={handleCategorySelect}
              categories={getLocalizedCategories(t)}
            />
            
            {/* Sort Options */}
            <SortOptions
              value={state.orderBy}
              onChange={handleSortChange}
              options={[
                { value: 'popular', label: t('imageSearch.sort.popular') },
                { value: 'latest', label: t('imageSearch.sort.latest') }
              ]}
            />
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!state.hasSearched ? (
              <FeaturedImages
                language={state.language}
                onSelect={handleImageSelect}
                onCategoryClick={handleCategoryClick}
              />
            ) : state.isLoading ? (
              <ImageGridSkeleton count={24} />
            ) : state.images.length > 0 ? (
              <>
                <ImageGrid
                  images={state.images}
                  onSelect={handleImageSelect}
                  showTitles={true}
                />
                <Pagination
                  page={state.page}
                  total={state.total}
                  perPage={24}
                  onChange={handlePageChange}
                />
              </>
            ) : (
              <EmptyState
                query={state.query}
                onReset={handleReset}
                suggestions={getSearchSuggestions(state.language)}
              />
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
};
```

## Phase 4: i18n Configuration

### 4.1 English Translations
```json
// frontend/src/locales/en/imageSearch.json
{
  "title": "Select Image",
  "tabs": {
    "library": "Library",
    "pixabay": "Stock Photos"
  },
  "placeholder": {
    "library": "Search our curated library...",
    "pixabay": "Search millions of stock photos..."
  },
  "categories": {
    "nature": "Nature",
    "animals": "Animals",
    "people": "People",
    "business": "Business",
    "technology": "Technology",
    "food": "Food",
    "sports": "Sports",
    "backgrounds": "Backgrounds"
  },
  "sort": {
    "popular": "Most Popular",
    "latest": "Newest"
  },
  "empty": {
    "noResults": "No images found for \"{{query}}\"",
    "tryDifferent": "Try different keywords or browse categories",
    "suggestions": "Suggestions:"
  },
  "safeContent": "Safe content only",
  "rateLimit": "Please wait {{seconds}} seconds before searching again"
}
```

### 4.2 Spanish Translations
```json
// frontend/src/locales/es/imageSearch.json
{
  "title": "Seleccionar Imagen",
  "tabs": {
    "library": "Biblioteca",
    "pixabay": "Fotos de Stock"
  },
  "placeholder": {
    "library": "Buscar en nuestra biblioteca...",
    "pixabay": "Buscar millones de fotos de stock..."
  },
  "categories": {
    "nature": "Naturaleza",
    "animals": "Animales",
    "people": "Personas",
    "business": "Negocios",
    "technology": "Tecnología",
    "food": "Comida",
    "sports": "Deportes",
    "backgrounds": "Fondos"
  },
  "sort": {
    "popular": "Más Popular",
    "latest": "Más Reciente"
  },
  "empty": {
    "noResults": "No se encontraron imágenes para \"{{query}}\"",
    "tryDifferent": "Prueba con diferentes palabras o explora las categorías",
    "suggestions": "Sugerencias:"
  },
  "safeContent": "Solo contenido seguro",
  "rateLimit": "Por favor espera {{seconds}} segundos antes de buscar de nuevo"
}
```

## Phase 5: R2 CDN Optimization

### 5.1 Cloudflare Worker for Image Transformation
```javascript
// Image optimization worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cache = caches.default;
    
    // Check cache
    let response = await cache.match(request);
    if (response) return response;
    
    // Determine transformation based on path
    const options = {};
    if (url.pathname.includes('/thumb/')) {
      options.cf = {
        image: {
          width: 300,
          height: 300,
          fit: 'cover',
          quality: 80,
          format: 'webp'
        }
      };
    } else if (url.pathname.includes('/preview/')) {
      options.cf = {
        image: {
          width: 800,
          height: 800,
          fit: 'inside',
          quality: 85,
          format: 'webp'
        }
      };
    }
    
    // Fetch from R2
    const r2Key = url.pathname.replace(/^\/(thumb|preview|original)\//, '');
    response = await env.R2_BUCKET.get(r2Key);
    
    if (!response) {
      return new Response('Image not found', { status: 404 });
    }
    
    // Apply transformations
    const transformedResponse = new Response(response.body, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'max-age=31536000'
      }
    });
    
    // Cache the transformed image
    event.waitUntil(cache.put(request, transformedResponse.clone()));
    
    return transformedResponse;
  }
};
```

## Phase 6: Testing Strategy

### 6.1 Unit Tests
- Database functions with EN/ES queries
- API endpoint response validation
- Frontend service caching logic
- Component rendering with translations

### 6.2 Integration Tests
- End-to-end search flow in both languages
- Language switching during active session
- Cache invalidation on language change
- Rate limiting with multiple users

### 6.3 Performance Benchmarks
- Search response time: < 500ms (cached), < 2s (uncached)
- Image load time: < 1s on 4G connection
- Cache hit rate: > 60%
- First contentful paint: < 1.5s

## Phase 7: Deployment Plan

### Week 1: Development
1. Deploy database schema to dev environment
2. Populate sample data with translations
3. Deploy API changes
4. Test with frontend changes locally

### Week 2: QA
1. Deploy to QA environment
2. Run full test suite
3. User acceptance testing
4. Performance profiling

### Week 3: Production
1. Database migration during low traffic (2 AM EST)
2. Deploy API with feature flag
3. Gradual rollout: 10% → 50% → 100%
4. Monitor metrics and error rates

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Search Response Time | < 500ms cached | P95 latency |
| Image Load Time | < 1s on 4G | Core Web Vitals |
| Cache Hit Rate | > 60% | CloudFlare Analytics |
| Spanish Coverage | 100% | Translation completeness |
| Error Rate | < 0.1% | Sentry monitoring |
| User Engagement | +20% | Image selection rate |

## Risk Mitigation

### Technical Risks
- **Database Migration Failure**: Keep backup, test rollback procedure
- **API Rate Limiting**: Implement circuit breaker, show cached results
- **CDN Outage**: Fallback to direct R2 URLs
- **Translation Quality**: Review with native speakers before launch

### Business Risks
- **User Confusion**: A/B test with small group first
- **Performance Degradation**: Load test with 10x expected traffic
- **Cost Increase**: Monitor API usage, implement quotas

## Maintenance Plan

### Regular Tasks
- Weekly: Review search analytics, popular queries
- Monthly: Update image popularity scores
- Quarterly: Add new categories/translations
- Annually: Audit and optimize database indexes

### Monitoring
- API response times (DataDog)
- Cache hit rates (CloudFlare)
- Error rates (Sentry)
- User engagement (Mixpanel)

## UI/UX Mockups

### Desktop View (1440px+)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Add Images to Your Story                                      [X]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search for images...                                    🔎 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Source: (•) All    ( ) Our Library    ( ) Stock Photos            │
│                                                                     │
│ Quick Categories:                                                  │
│ [Nature] [Animals] [People] [Food] [School] [Home] [+More]        │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │                         Results Grid                        │   │
│ │                                                             │   │
│ │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │   │
│ │  │     │  │     │  │     │  │     │  │     │  │     │    │   │
│ │  │ IMG │  │ IMG │  │ IMG │  │ IMG │  │ IMG │  │ IMG │    │   │
│ │  │     │  │     │  │     │  │     │  │     │  │     │    │   │
│ │  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │   │
│ │  Library  Stock    Library  Library  Stock    Stock        │   │
│ │                                                             │   │
│ │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │   │
│ │  │     │  │     │  │     │  │     │  │     │  │     │    │   │
│ │  │ IMG │  │ IMG │  │ IMG │  │ IMG │  │ IMG │  │ IMG │    │   │
│ │  │     │  │     │  │     │  │     │  │     │  │     │    │   │
│ │  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │   │
│ │  Library  Library  Stock    Stock    Library  Stock        │   │
│ │                                                             │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Showing 1-12 of 156 results        [◀] Page 1 of 13 [▶]          │
│                                                                     │
│                                          [Cancel] [Select Image]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Tablet View (768px - 1439px)
```
┌──────────────────────────────────────────┐
│ Add Images                         [X]  │
├──────────────────────────────────────────┤
│ ┌───────────────────────────────────┐ │
│ │ 🔍 Search...                    🔎 │ │
│ └───────────────────────────────────┘ │
│                                         │
│ (•) All  ( ) Library  ( ) Stock        │
│                                         │
│ [Nature] [Animals] [People] [+]        │
│                                         │
│ ┌───────────────────────────────────┐ │
│ │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐│ │
│ │  │ IMG │  │ IMG │  │ IMG │  │ IMG ││ │
│ │  └─────┘  └─────┘  └─────┘  └─────┘│ │
│ │  Lib      Stock    Lib      Stock   │ │
│ │                                      │ │
│ │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐│ │
│ │  │ IMG │  │ IMG │  │ IMG │  │ IMG ││ │
│ │  └─────┘  └─────┘  └─────┘  └─────┘│ │
│ │  Stock    Lib      Stock    Lib     │ │
│ └───────────────────────────────────┘ │
│                                         │
│ 1-8 of 156          [◀] 1/20 [▶]      │
│                                         │
│              [Cancel] [Select]         │
└──────────────────────────────────────────┘
```

### Mobile View (< 768px)
```
┌──────────────────┐
│ Images      [X]  │
├──────────────────┤
│ ┌───────────────┐ │
│ │ 🔍 Search... 🔎│ │
│ └───────────────┘ │
│                   │
│ (•) All          │
│ ( ) Library      │
│ ( ) Stock        │
│                   │
│ [Nature] [Animals]│
│ [People] [More...] │
│                   │
│ ┌───────────────┐ │
│ │ ┌─────┐ ┌─────┐│ │
│ │ │IMG │ │IMG │ │ │
│ │ └─────┘ └─────┘│ │
│ │  Lib    Stock  │ │
│ │                │ │
│ │ ┌─────┐ ┌─────┐│ │
│ │ │IMG │ │IMG │ │ │
│ │ └─────┘ └─────┘│ │
│ │  Stock  Lib    │ │
│ └───────────────┘ │
│                   │
│ Page 1 of 13     │
│ [◀]     [▶]     │
│                   │
│ [Cancel] [Select] │
└──────────────────┘
```

### Key Design Decisions

1. **Unified Search**: Single input field for all image sources
2. **Source Mixing**: Library and stock photos in same grid with labels
3. **Progressive Disclosure**: Categories shown as pills, expandable on mobile
4. **Responsive Grid**: 6 columns (desktop), 4 columns (tablet), 2 columns (mobile)
5. **Clear Attribution**: Each image labeled with its source
6. **Conservative UX**: Maintains familiar wizard-like pattern from current design

## Phased Implementation Plan

### Phase 1: Database Foundation
**Objective**: Establish bilingual data model with search capabilities

**Deliverables**:
1. Database schema migration scripts
2. Custom images table with R2 URLs
3. Translations table (EN/ES)
4. Full-text search indexes
5. Search stored procedures

**Explicit Tasks**:
```sql
-- Task 1.1: Create core tables
CREATE TABLE custom_images (id, url, thumbnail_url, category, metadata)
CREATE TABLE custom_images_translations (image_id, language_code, title, tags, search_vector)

-- Task 1.2: Create search function
CREATE FUNCTION search_custom_images_i18n(query, language, category, page, per_page)

-- Task 1.3: Import existing data
INSERT INTO custom_images SELECT * FROM json_to_recordset(custom-images.json)

-- Task 1.4: Generate translations
INSERT INTO custom_images_translations (image_id, language_code, title)
```

**Validation Gates**:
- [ ] Schema deployed to dev environment
- [ ] Search queries return results < 100ms
- [ ] Both EN and ES translations present
- [ ] Category filtering works

### Phase 2: API Unification
**Objective**: Single endpoint serving both image sources with i18n

**Deliverables**:
1. Unified `/v1/images/search` endpoint
2. Featured images endpoint
3. Rate limiting implementation
4. Cache headers configuration

**Explicit Tasks**:
```typescript
// Task 2.1: Update search endpoint
GET /v1/images/search?query=&lang=&provider=&category=&page=&perPage=

// Task 2.2: Implement parallel search
Promise.all([searchPixabay(), searchCustomImages()])

// Task 2.3: Add rate limiting
checkRateLimit(context) with 100 req/60s window

// Task 2.4: Configure caching
Cache-Control: public, max-age=3600
Vary: Accept-Language
```

**Validation Gates**:
- [ ] Endpoint returns unified results
- [ ] Language parameter changes results
- [ ] Rate limiting blocks after threshold
- [ ] Response includes cache headers

### Phase 3: Frontend Service Layer
**Objective**: Client-side caching and offline support

**Deliverables**:
1. ImageCache class with TTL
2. Updated ImageProxyService
3. IndexedDB schema for offline
4. Background sync registration

**Explicit Tasks**:
```typescript
// Task 3.1: Implement cache
class ImageCache {
  getCacheKey(options): string
  get(options): SearchResponse | null
  set(options, data): void
}

// Task 3.2: Update service
ImageProxyService.searchImages(options) with cache check

// Task 3.3: Add offline storage
db.images.bulkPut(cachedImages)

// Task 3.4: Register background sync
registerBackgroundSync('image-sync')
```

**Validation Gates**:
- [ ] Cache hit rate measurable
- [ ] Offline mode returns cached results
- [ ] Background sync queues requests
- [ ] Memory cache clears on language change

### Phase 4: UI Components
**Objective**: Unified search interface with source mixing

**Deliverables**:
1. UnifiedImageSearch component
2. Mixed grid with source labels
3. Category pills filter
4. Responsive layouts

**Explicit Tasks**:
```tsx
// Task 4.1: Create unified search
<UnifiedImageSearch onSelect={} onClose={}>

// Task 4.2: Add source filters
<RadioGroup value={provider}>
  <Radio value="all">All</Radio>
  <Radio value="library">Library</Radio>
  <Radio value="pixabay">Stock</Radio>
</RadioGroup>

// Task 4.3: Build mixed grid
<ImageGrid images={mixed} showSource={true}>

// Task 4.4: Add category pills
<CategoryPills selected={category} onSelect={}>
```

**Validation Gates**:
- [ ] Single search bar for all sources
- [ ] Images show source labels
- [ ] Category filter updates results
- [ ] Responsive on mobile/tablet/desktop

### Phase 5: Internationalization
**Objective**: Complete EN/ES translation coverage

**Deliverables**:
1. English translation file
2. Spanish translation file
3. Component t() integration
4. Language switcher sync

**Explicit Tasks**:
```json
// Task 5.1: Create en/imageSearch.json
{
  "tabs.library": "Library",
  "tabs.pixabay": "Stock Photos",
  "search.placeholder": "Search images..."
}

// Task 5.2: Create es/imageSearch.json
{
  "tabs.library": "Biblioteca",
  "tabs.pixabay": "Fotos de Stock",
  "search.placeholder": "Buscar imágenes..."
}

// Task 5.3: Update components
t('imageSearch:search.placeholder')

// Task 5.4: Sync language changes
useEffect(() => refetch, [i18n.language])
```

**Validation Gates**:
- [ ] All UI strings use t() function
- [ ] Spanish translations reviewed
- [ ] Language switch refreshes results
- [ ] No hardcoded strings remain

### Phase 6: Progressive Enhancement
**Objective**: Incremental improvements based on usage

**Continuous Tasks**:
1. Monitor search patterns
2. Add popular search suggestions
3. Optimize frequent queries
4. Expand category taxonomy
5. Improve Spanish translations
6. Add image preview on hover
7. Implement virtualized scrolling
8. Add recent searches
9. Create image collections
10. Enable batch selection

**Incremental Elaboration Process**:
```
1. Deploy MVP (Phases 1-5)
   ↓
2. Collect usage metrics
   ↓
3. Identify top improvement
   ↓
4. Implement enhancement
   ↓
5. A/B test with users
   ↓
6. Measure impact
   ↓
7. Repeat cycle
```

## Incremental Elaboration Strategy

### Iteration 1: Core Functionality
- Basic search across both sources
- Simple grid layout
- English only
- No caching

### Iteration 2: Performance
- Add caching layer
- Implement pagination
- Add loading states
- Optimize queries

### Iteration 3: Internationalization
- Add Spanish translations
- Language-aware search
- Localized categories
- RTL support prep

### Iteration 4: User Experience
- Add category filters
- Featured images
- Search suggestions
- Empty states

### Iteration 5: Advanced Features
- Offline support
- Background sync
- Batch operations
- Collections

## Dependency Graph

```
Database Schema
    ↓
Migration Scripts → Data Import
    ↓
Search Functions → API Endpoints → Frontend Service
                        ↓              ↓
                  Rate Limiting    Caching Layer
                                       ↓
                                  UI Components → i18n Files
                                       ↓
                                  Responsive Design
```

## Rollback Procedures

### Database Rollback
```sql
-- Save current state
pg_dump > backup_before_migration.sql
-- Rollback if needed
psql < backup_before_migration.sql
```

### API Rollback
```bash
# Tag before deployment
git tag pre-image-search-update
# Rollback if needed
git checkout pre-image-search-update
npm run deploy:prod
```

### Frontend Rollback
```bash
# Use feature flag
if (features.unifiedImageSearch) {
  return <UnifiedImageSearch />
} else {
  return <LegacyImageSearch />
}
```

## Success Metrics

| Metric | Measurement Method | Success Criteria |
|--------|-------------------|------------------|
| Search Speed | API response time | P95 < 500ms |
| Cache Effectiveness | Hit rate calculation | > 60% hits |
| User Engagement | Click-through rate | +20% selections |
| Spanish Adoption | Language analytics | > 30% ES users |
| Error Rate | Sentry monitoring | < 0.1% |

## Risk Matrix

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Migration failure | Test in dev first | Rollback script |
| Translation quality | Native review | Quick fixes |
| Performance impact | Load testing | Scale resources |
| User confusion | A/B testing | Feature flag |

## Vector Embedding Implementation Summary

### Overview
This enhanced design incorporates semantic search capabilities using vector embeddings from Qwen2.5-VL-7B, enabling better multi-word query understanding for social story image searches.

### Key Enhancements

#### 1. Hybrid Search Strategy
- **Single-word queries**: Use existing full-text search (fast, precise)
- **Multi-word queries**: Use vector similarity search with embeddings
- **Threshold**: Cosine distance < 0.5 for relevance

#### 2. Query Processing Pipeline
```
User Query → Word Count Check → Route Decision
                ↓                      ↓
         Single Word            Multi-Word
                ↓                      ↓
         Full-text Search      Query Expansion (GPT-4o-mini)
                                       ↓
                                Generate Embedding (Qwen2.5-VL)
                                       ↓
                                Vector Similarity Search
```

#### 3. Data Processing Updates
- **Batch Processing**: 1,196 images already categorized with social story topics
- **Embedding Generation**: Add Qwen2.5-VL embeddings (768-dim) to each image
- **Storage**: PostgreSQL with pgvector extension
- **Index**: IVFFlat index for efficient similarity search

#### 4. Database Schema Changes
```sql
-- Enable vector support
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE custom_images 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create similarity index
CREATE INDEX idx_custom_images_embedding ON custom_images 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### 5. API Integration
- New `/expand-query` endpoint for dynamic query enhancement
- Modified search to use hybrid approach based on query complexity
- Embedding generation via vLLM API at `http://localhost:8000/v1/embeddings`

### Implementation Steps

1. **Schema Migration** (Non-prod first)
   - Enable pgvector extension
   - Add embedding column to custom_images
   - Create vector similarity index

2. **Generate Embeddings**
   - Install BGE-M3 locally for batch processing
   - Process existing 1,196 images with BGE-M3
   - Store 1024-dimensional vectors

3. **Deploy Search Functions**
   - Deploy search_custom_images_semantic function
   - Test with sample queries in Spanish/English
   - Validate performance (~400-600ms total)

4. **API Updates**
   - Deploy embedding generation endpoint using Cloudflare Workers AI
   - Update search endpoint to use semantic search
   - Add caching for frequent queries (5 min TTL)

5. **Frontend Integration**
   - Call embedding endpoint for ALL searches
   - Pass embedding to search function
   - Display results with relevance scoring

### Performance Considerations
- BGE-M3 embedding generation: ~100-300ms
- Vector similarity search: ~100ms
- Total search latency: ~400-600ms (acceptable)
- Embeddings pre-computed offline for images
- IVFFlat index tuned for ~1,200 images (lists=35)

### Testing Strategy
- Test multilingual queries: "angry" vs "enojado"
- Verify semantic matches: "school" finds "classroom", "teacher"
- Test without language parameter (BGE-M3 auto-detects)
- Measure precision/recall improvements

## Next Actions

1. **Immediate**: Deploy database schema with pgvector (1024 dims) to non-prod
2. **Next**: Generate BGE-M3 embeddings for all 1,196 processed images
3. **Then**: Deploy semantic search function and test
4. **Finally**: Update API with BGE-M3 embedding endpoint

## Conclusion

This plan emphasizes incremental elaboration with semantic search capabilities via vector embeddings. The hybrid approach maintains fast performance for simple queries while enabling intelligent multi-word understanding for complex searches, perfectly suited for social story content discovery.