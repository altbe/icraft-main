# Custom Images Schema Analysis & Issues

## Current Schema Structure

### Table: `custom_images`
**Contains**: Core image metadata and files
- `id` (uuid)
- `r2_key` (text) - Cloud storage key
- `url` (text) - Image URL
- `thumbnail_url` (text) - Thumbnail URL
- `category_id` (text) - Category identifier
- `embedding` (vector) - 1024-dim vector for semantic search
- `width`, `height`, `file_size_bytes` - Image metadata
- `is_active`, `is_safe` - Status flags
- `popularity_score`, `view_count`, `usage_count` - Metrics
- `created_at`, `updated_at` - Timestamps

### Table: `custom_images_translations`
**Contains**: Language-specific text and search data
- `id` (uuid)
- `image_id` (uuid) - FK to custom_images
- `language_code` (text) - 'en', 'es', etc.
- `title` (text) - Translated title
- `description` (text) - Translated description
- `tags` (text[]) - Translated tags
- `search_vector` (tsvector) - Full-text search index
- `created_at`, `updated_at` - Timestamps

**Note**: Does NOT contain `thumbnail_url`, `width`, `height`, etc. - these come from `custom_images`

## Critical Issues in `search_custom_images_vector`

### Issue 1: Incorrect Field References
The function uses `ci.category` but the actual column is `ci.category_id`:
```sql
-- WRONG (current):
WHERE (p_category_id IS NULL OR ci.category = p_category_id)

-- CORRECT (should be):
WHERE (p_category_id IS NULL OR ci.category_id = p_category_id)
```

### Issue 2: Vector Search Logic Confusion
The function has two modes but both have issues:

1. **Vector mode** (`p_use_vector = true`):
   - Uses `ci.embedding` (correct - this is on custom_images table)
   - But still references `ci.category` (should be `ci.category_id`)

2. **Text mode** (`p_use_vector = false`):
   - Should use `cit.search_vector` from translations table
   - Currently correct in the text search part
   - But the vector/text distinction is confusing

### Issue 3: Missing Description in Results
Both functions return empty description:
```sql
-- Current in search_custom_images_i18n:
'' AS img_description

-- Should be:
COALESCE(cit.description, cit_en.description, '') AS img_description
```

## Correct Implementation Pattern

### For Text Search (using translations):
```sql
-- Join custom_images with translations
FROM custom_images ci
LEFT JOIN custom_images_translations cit 
  ON ci.id = cit.image_id AND cit.language_code = p_language
LEFT JOIN custom_images_translations cit_en 
  ON ci.id = cit_en.image_id AND cit_en.language_code = 'en'

-- Search using translation search_vector
WHERE cit.search_vector @@ plainto_tsquery(v_language_config, p_query)
   OR cit_en.search_vector @@ plainto_tsquery('english', p_query)
```

### For Vector Search (using embeddings):
```sql
-- Use embedding from custom_images table
FROM custom_images ci
WHERE ci.embedding IS NOT NULL
  AND 1 - (ci.embedding <=> p_query_embedding) > p_vector_threshold
```

### Proper Column Selection:
```sql
SELECT 
  ci.id,                                          -- From custom_images
  ci.url,                                         -- From custom_images
  ci.thumbnail_url,                               -- From custom_images
  COALESCE(cit.title, cit_en.title),            -- From translations
  COALESCE(cit.description, cit_en.description), -- From translations
  ci.category_id,                                 -- From custom_images
  COALESCE(cit.tags, cit_en.tags),               -- From translations
  ci.width,                                       -- From custom_images
  ci.height                                       -- From custom_images
```

## Migration Plan

### 1. Fix `search_custom_images_vector` function:
```sql
-- Fix category field reference
-- Fix description field selection
-- Ensure proper joins between tables
```

### 2. Fix `search_custom_images_i18n` function:
```sql
-- Add description field properly
-- Ensure consistent category_id usage
```

### 3. Verify categories tables exist:
```sql
-- Check if categories and categories_translations exist
-- If not, remove references or create tables
```

## Recommendations

1. **Immediate**: Fix the `ci.category` → `ci.category_id` issue in both functions
2. **Important**: Add proper description field to results
3. **Clarify**: Document when to use vector vs text search
4. **Test**: Verify both search modes work with actual data
5. **Consider**: Renaming functions for clarity:
   - `search_custom_images_text` for text-based search
   - `search_custom_images_semantic` for vector-based search