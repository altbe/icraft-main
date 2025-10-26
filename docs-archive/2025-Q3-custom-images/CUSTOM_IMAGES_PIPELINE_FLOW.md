# Custom Images Backend Pipeline - Architecture Flow Diagram

## Overview
The custom images pipeline is a sophisticated multi-stage system that processes, categorizes, indexes, and serves a proprietary image library for iCraftStories. It employs AI-powered semantic search, multilingual support, and automatic content categorization.

## High-Level Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend                API Gateway              Backend Services      │
│  ┌──────┐              ┌──────────┐              ┌───────────────┐    │
│  │Client├──────────────►│  Zuplo   ├──────────────►│icraft-images  │    │
│  └──────┘   /images    └──────────┘   Auth+Route  └──────┬───────┘    │
│                                                           │             │
└───────────────────────────────────────────────────────────┼─────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SEARCH LOGIC GATES                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                          ┌─────────────┐                               │
│                          │Search Request│                               │
│                          └──────┬──────┘                               │
│                                 │                                       │
│                      ┌──────────▼──────────┐                          │
│                      │Provider Selection   │                           │
│                      │ - all (unified)     │                           │
│                      │ - custom (proprietary)│                          │
│                      │ - pixabay (stock)   │                           │
│                      └──────────┬──────────┘                          │
│                                 │                                       │
│         ┌───────────────────────┼───────────────────────┐              │
│         ▼                       ▼                       ▼              │
│   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐      │
│   │Provider: ALL│        │Provider:CUSTOM│       │Provider:PIXABAY│    │
│   └──────┬──────┘        └──────┬──────┘        └──────┬──────┘      │
│          │                       │                       │              │
│   ┌──────▼──────┐               │                ┌──────▼──────┐      │
│   │Unified Search│              │                │Pixabay API  │      │
│   │ 1. Custom    │              │                │  REST Call   │      │
│   │ 2. Pixabay  │              │                └──────────────┘      │
│   └──────┬──────┘               │                                      │
│          └───────────────────────┤                                      │
│                                 ▼                                       │
│                    ┌─────────────────────────┐                        │
│                    │ Query Processing Gate   │                        │
│                    │ - Sanitization          │                        │
│                    │ - Language Detection    │                        │
│                    │ - Query Truncation      │                        │
│                    └───────────┬─────────────┘                        │
│                                │                                       │
│                    ┌───────────▼───────────┐                          │
│                    │ Embedding Generation  │                          │
│                    │     Decision          │                          │
│                    └───────────┬───────────┘                          │
│                                │                                       │
│              ┌─────────────────┼─────────────────┐                    │
│              ▼                                   ▼                     │
│    ┌──────────────────┐              ┌──────────────────┐            │
│    │Semantic Search   │              │Text Search       │            │
│    │(if embedding)    │              │(fallback)        │            │
│    └──────────────────┘              └──────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

## Semantic Search Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SEMANTIC SEARCH FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    ┌──────────────┐                                                    │
│    │ Query String │                                                    │
│    └──────┬───────┘                                                    │
│           │                                                             │
│    ┌──────▼───────────────────────┐                                   │
│    │ generateEmbeddingInline()    │                                   │
│    │ - Check CF credentials       │                                   │
│    │ - Truncate to 512 chars      │                                   │
│    └──────┬───────────────────────┘                                   │
│           │                                                             │
│    ┌──────▼───────────────────────┐                                   │
│    │ Cloudflare Workers AI        │                                   │
│    │ Model: @cf/baai/bge-m3       │                                   │
│    │ Output: 1024-dim vector      │                                   │
│    └──────┬───────────────────────┘                                   │
│           │                                                             │
│    ┌──────▼───────────────────────┐                                   │
│    │ Vector Similarity Search     │                                   │
│    │ Function: search_custom_     │                                   │
│    │   images_vector()            │                                   │
│    │ - Cosine similarity          │                                   │
│    │ - Threshold: 0.3             │                                   │
│    └──────┬───────────────────────┘                                   │
│           │                                                             │
│    ┌──────▼───────────────────────┐                                   │
│    │ Results Ranking               │                                   │
│    │ - Sort by similarity score   │                                   │
│    │ - Apply pagination           │                                   │
│    └──────────────────────────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Function Logic Flow

```sql
┌─────────────────────────────────────────────────────────────────────────┐
│             search_custom_images_vector() LOGIC GATES                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input Parameters:                                                      │
│  ┌────────────────────────────────┐                                   │
│  │ p_query: text                  │                                   │
│  │ p_language: 'en' | 'es'        │                                   │
│  │ p_category_id: text (optional) │                                   │
│  │ p_query_embedding: vector      │                                   │
│  │ p_use_vector: boolean          │                                   │
│  │ p_vector_threshold: 0.3        │                                   │
│  └────────────┬───────────────────┘                                   │
│               │                                                         │
│       ┌───────▼────────┐                                              │
│       │ Gate: Has      │                                              │
│       │ Embedding?     │                                              │
│       └───────┬────────┘                                              │
│               │                                                         │
│         YES ──┼── NO                                                   │
│         │          │                                                   │
│    ┌────▼────┐ ┌──▼──────────┐                                       │
│    │ VECTOR  │ │ TEXT SEARCH  │                                       │
│    │ SEARCH  │ │              │                                       │
│    └────┬────┘ └──┬──────────┘                                       │
│         │          │                                                   │
│    ┌────▼──────────▼────┐                                             │
│    │ Common Filters:    │                                             │
│    │ - is_active = true │                                             │
│    │ - is_safe = true   │                                             │
│    │ - category filter  │                                             │
│    └────────┬───────────┘                                             │
│             │                                                          │
│    ┌────────▼───────────┐                                             │
│    │ Join Tables:       │                                             │
│    │ - custom_images_   │                                             │
│    │   translations     │                                             │
│    │ - categories_      │                                             │
│    │   translations     │                                             │
│    └────────┬───────────┘                                             │
│             │                                                          │
│    ┌────────▼───────────┐                                             │
│    │ Result Processing: │                                             │
│    │ - Pagination       │                                             │
│    │ - Total count      │                                             │
│    │ - Relevance score  │                                             │
│    └────────────────────┘                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Content Processing Pipeline (Batch Operations)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMAGE PROCESSING PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STAGE 1: Discovery                                                    │
│  ┌─────────────────────┐                                              │
│  │ scan-r2-incremental │                                              │
│  │ - Find new images   │                                              │
│  │ - Since date filter │                                              │
│  └──────────┬──────────┘                                              │
│             │                                                          │
│             ▼ r2-images-incremental_*.json                            │
│                                                                         │
│  STAGE 2: Categorization                                              │
│  ┌─────────────────────────┐                                          │
│  │ process-images-vllm-s3  │                                          │
│  │ Model: Qwen2.5-VL-7B    │                                          │
│  │ - Detect content        │                                          │
│  │ - Assign categories     │                                          │
│  │ - Generate descriptions │                                          │
│  │ - Spanish translations  │                                          │
│  └──────────┬──────────────┘                                          │
│             │                                                          │
│             ▼ categorized_*.json                                      │
│                                                                         │
│  STAGE 3: Embedding Generation                                        │
│  ┌─────────────────────────────┐                                      │
│  │ generate-bge-m3-embeddings  │                                      │
│  │ Model: BAAI/bge-m3          │                                      │
│  │ - 1024-dim vectors          │                                      │
│  │ - Multilingual support      │                                      │
│  │ - JSONL output format       │                                      │
│  └──────────┬──────────────────┘                                      │
│             │                                                          │
│             ▼ embeddings_for_insert_*.jsonl                           │
│                                                                         │
│  STAGE 4: Database Deployment                                         │
│  ┌─────────────────────────────────┐                                  │
│  │ deploy-jsonl-to-supabase        │                                  │
│  │ - Update custom_images          │                                  │
│  │ - Store embeddings              │                                  │
│  │ - Deploy to prod & non-prod    │                                  │
│  └─────────────────────────────────┘                                  │
│                                                                         │
│  ┌─────────────────────────────────┐                                  │
│  │ deploy-translations             │                                  │
│  │ - Update translations tables    │                                  │
│  │ - Categories & images           │                                  │
│  │ - English & Spanish             │                                  │
│  └─────────────────────────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Unified Provider Pagination Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   UNIFIED PAGINATION ALGORITHM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: page=2, perPage=20, provider="all"                            │
│                                                                         │
│  ┌────────────────────────┐                                           │
│  │ Get Provider Counts    │                                           │
│  │ - Custom: 47 images    │                                           │
│  │ - Pixabay: 200 images  │                                           │
│  │ - Total: 247 images    │                                           │
│  └───────────┬────────────┘                                           │
│              │                                                         │
│  ┌───────────▼────────────┐                                           │
│  │ Calculate Boundaries   │                                           │
│  │ startIndex = 20        │ (page-1) * perPage                       │
│  │ endIndex = 40          │ startIndex + perPage                     │
│  └───────────┬────────────┘                                           │
│              │                                                         │
│  ┌───────────▼────────────┐                                           │
│  │ Decision Gate:         │                                           │
│  │ startIndex < customTotal?                                          │
│  └───────────┬────────────┘                                           │
│              │                                                         │
│         YES ─┼─ NO                                                    │
│         │         │                                                   │
│    ┌────▼────┐ ┌─▼──────────────┐                                   │
│    │ Scenario│ │ Scenario 2:     │                                   │
│    │ 1:      │ │ Only Pixabay    │                                   │
│    │ Mixed   │ │ pixabayStart =  │                                   │
│    │ Results │ │   startIndex -  │                                   │
│    │         │ │   customTotal   │                                   │
│    └─────────┘ └────────────────┘                                   │
│                                                                         │
│  Page 1: [Custom 1-20]                                                │
│  Page 2: [Custom 21-40]                                               │
│  Page 3: [Custom 41-47, Pixabay 1-13]                                 │
│  Page 4: [Pixabay 14-33]                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐         ┌──────────────────────┐            │
│  │   custom_images     │────────►│ custom_images_       │            │
│  │                     │ 1:N     │ translations         │            │
│  ├─────────────────────┤         ├──────────────────────┤            │
│  │ id (UUID PK)        │         │ id (UUID PK)         │            │
│  │ r2_key              │         │ image_id (FK)        │            │
│  │ url                 │         │ language_code        │            │
│  │ thumbnail_url       │         │ title                │            │
│  │ category_id (FK) ───┼───┐     │ description          │            │
│  │ embedding (vector)  │   │     │ tags[]               │            │
│  │ width, height       │   │     │ search_vector        │            │
│  │ is_active           │   │     └──────────────────────┘            │
│  │ is_safe             │   │                                          │
│  └─────────────────────┘   │                                          │
│                             │                                          │
│  ┌─────────────────────┐   │     ┌──────────────────────┐            │
│  │    categories       │◄──┘────►│ categories_          │            │
│  │                     │ 1:N     │ translations         │            │
│  ├─────────────────────┤         ├──────────────────────┤            │
│  │ id (PK)             │         │ category_id (FK)     │            │
│  │ icon                │         │ language_code        │            │
│  │ sort_order          │         │ name                 │            │
│  │ is_active           │         │ description          │            │
│  └─────────────────────┘         └──────────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Error Handling & Fallback Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                                                  │
│  │ Embedding Fails │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│      ┌────▼─────┐                                                     │
│      │ Fallback │                                                     │
│      │ to Text  │                                                     │
│      │ Search   │                                                     │
│      └──────────┘                                                     │
│                                                                         │
│  ┌─────────────────┐                                                  │
│  │ Pixabay Fails   │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│      ┌────▼─────┐                                                     │
│      │ Return   │                                                     │
│      │ Custom   │                                                     │
│      │ Only     │                                                     │
│      └──────────┘                                                     │
│                                                                         │
│  ┌─────────────────┐                                                  │
│  │ Database Error  │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│      ┌────▼─────┐                                                     │
│      │ HTTP 500 │                                                     │
│      │ Problem  │                                                     │
│      └──────────┘                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Features & Capabilities

### 1. **Multilingual Support**
- Primary languages: English (en) and Spanish (es)
- Language-specific translations for titles, descriptions, and tags
- Language-agnostic BGE-M3 embeddings work across languages

### 2. **Hybrid Search**
- **Semantic Search**: BGE-M3 1024-dimensional vector embeddings
- **Text Search**: PostgreSQL full-text search with language-specific configurations
- **Automatic Fallback**: Degrades gracefully from vector to text search

### 3. **Content Safety**
- `is_safe` flag for content filtering
- `is_active` flag for soft deletion
- Category-based content organization

### 4. **Performance Optimization**
- Result caching (1-hour cache headers)
- Pagination with efficient offset/limit
- Vector similarity threshold (0.3) to limit results
- Unified provider pagination to minimize API calls

### 5. **Scalability**
- Incremental processing for new images
- Batch processing with JSONL format
- Parallel deployment to multiple environments
- Currently handles 1,196 images with room for growth

## API Response Format

```json
{
  "images": [
    {
      "url": "https://...",
      "provider": "custom",
      "metadata": {
        "id": "uuid",
        "title": "Image Title",
        "description": "Description in requested language",
        "category": "animals",
        "category_id": "animals",
        "tags": ["tag1", "tag2"],
        "width": 1024,
        "height": 768,
        "relevance_score": 0.95
      }
    }
  ],
  "total": 247,
  "page": 2
}
```

## Security Considerations

1. **Input Sanitization**: All queries sanitized before processing
2. **Service Key Access**: Supabase service keys bypass RLS
3. **API Authentication**: Clerk JWT validation at Zuplo gateway
4. **Rate Limiting**: Handled at API gateway level
5. **Content Filtering**: is_safe and is_active flags enforced

## Cost Optimization

- **Cloudflare Workers AI**: ~$0.03/month for 3,000 searches
- **Caching**: 1-hour cache reduces API calls
- **Batch Processing**: Minimizes individual API requests
- **Incremental Updates**: Process only new/modified images

## Future Enhancements

- [ ] Real-time embedding generation for user uploads
- [ ] Additional language support beyond English/Spanish
- [ ] Image quality scoring and automatic filtering
- [ ] Smart category suggestions based on embeddings
- [ ] User preference learning for personalized results