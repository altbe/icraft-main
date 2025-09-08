# Category Column Consolidation Plan

## Current State Analysis

### Production & Non-Production (Identical)
- **`category` column**: Populated with 14 distinct values (1,196 images)
- **`category_id` column**: All NULL values
- **Issue**: Functions incorrectly reference `ci.category` in some places, `ci.category_id` in others

### Category Values Distribution
```
emotions: 293 images
routines: 228 images  
play: 123 images
food: 119 images
communication: 114 images
other: 67 images
social: 54 images
school: 52 images
nature: 46 images
community: 42 images
transportation: 34 images
safety: 14 images
sensory: 6 images
home: 4 images
```

## Migration Strategy

### Phase 1: Data Migration (Safe - No Breaking Changes)
1. Copy `category` values to `category_id` column
2. Verify data integrity
3. Update functions to consistently use `category_id`

### Phase 2: Column Cleanup (After Verification)
1. Drop the `category` column
2. Rename column in code if needed

## Migration Scripts

### Step 1: Data Migration Script
```sql
-- Migration: Copy category to category_id
-- Safe to run multiple times (idempotent)

BEGIN;

-- Copy category values to category_id where category_id is null
UPDATE custom_images 
SET category_id = category 
WHERE category_id IS NULL AND category IS NOT NULL;

-- Verify the update
SELECT 
    COUNT(*) as total_updated,
    COUNT(DISTINCT category_id) as unique_categories
FROM custom_images 
WHERE category_id IS NOT NULL;

COMMIT;
```

### Step 2: Fix Functions Script
```sql
-- Fix search_custom_images_vector to use category_id consistently

CREATE OR REPLACE FUNCTION public.search_custom_images_vector(
    p_query text DEFAULT NULL::text,
    p_language text DEFAULT 'en'::text,
    p_category_id text DEFAULT NULL::text,
    p_page integer DEFAULT 1,
    p_per_page integer DEFAULT 20,  -- Note: different in prod (24)
    p_order_by text DEFAULT 'relevance'::text,
    p_use_vector boolean DEFAULT false,
    p_query_embedding vector DEFAULT NULL::vector,
    p_vector_threshold double precision DEFAULT 0.3
)
RETURNS TABLE(
    image_id uuid,
    image_url text,
    thumbnail_url text,
    title text,
    description text,
    category_id text,
    category_name text,
    tags text[],
    width integer,
    height integer,
    relevance_score real,
    total_count bigint
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset INTEGER;
  v_search_query tsquery;
  v_language_config regconfig;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  
  v_language_config := CASE p_language
    WHEN 'es' THEN 'spanish'::regconfig
    ELSE 'english'::regconfig
  END;
  
  IF p_query IS NOT NULL AND p_query != '' THEN
    v_search_query := plainto_tsquery(v_language_config, p_query);
  END IF;
  
  IF p_use_vector AND p_query_embedding IS NOT NULL THEN
    -- Vector-based semantic search
    RETURN QUERY
    WITH vector_results AS (
      SELECT 
        ci.id,
        ci.url,
        ci.thumbnail_url,
        COALESCE(cit.title, cit_en.title, 'Untitled') AS title,
        COALESCE(cit.description, cit_en.description, '') AS description,
        ci.category_id,  -- FIXED: was ci.category
        COALESCE(cat_t.name, cat_t_en.name, ci.category_id, 'Uncategorized') AS category_name,
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
        ON ci.category_id = cat_t.category_id AND cat_t.language_code = p_language
      LEFT JOIN categories_translations cat_t_en
        ON ci.category_id = cat_t_en.category_id AND cat_t_en.language_code = 'en'
      WHERE 
        ci.is_active = true
        AND ci.is_safe = true
        AND ci.embedding IS NOT NULL
        AND (p_category_id IS NULL OR ci.category_id = p_category_id)  -- FIXED
        AND 1 - (ci.embedding <=> p_query_embedding) > p_vector_threshold
    )
    SELECT 
      id AS image_id,
      url AS image_url,
      thumbnail_url,
      title,
      description,
      category_id,
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
    -- Text-based search using translations
    RETURN QUERY
    WITH text_results AS (
      SELECT 
        ci.id,
        ci.url,
        ci.thumbnail_url,
        COALESCE(cit.title, cit_en.title, 'Untitled') AS title,
        COALESCE(cit.description, cit_en.description, '') AS description,
        ci.category_id,  -- FIXED: was ci.category
        COALESCE(cat_t.name, cat_t_en.name, ci.category_id, 'Uncategorized') AS category_name,
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
        ON ci.category_id = cat_t.category_id AND cat_t.language_code = p_language
      LEFT JOIN categories_translations cat_t_en
        ON ci.category_id = cat_t_en.category_id AND cat_t_en.language_code = 'en'
      WHERE 
        ci.is_active = true
        AND ci.is_safe = true
        AND (p_category_id IS NULL OR ci.category_id = p_category_id)  -- FIXED
        AND (
          p_query IS NULL 
          OR p_query = '' 
          OR cit.search_vector @@ v_search_query 
          OR cit_en.search_vector @@ plainto_tsquery('english', p_query)
        )
    )
    SELECT 
      id AS image_id,
      url AS image_url,
      thumbnail_url,
      title,
      description,
      category_id,
      category_name,
      tags,
      width,
      height,
      rank::REAL AS relevance_score,
      total::BIGINT AS total_count
    FROM text_results
    ORDER BY rank DESC
    LIMIT p_per_page
    OFFSET v_offset;
  END IF;
END;
$function$;

-- Also fix search_custom_images_i18n to return description
CREATE OR REPLACE FUNCTION public.search_custom_images_i18n(
    p_query text DEFAULT ''::text,  -- Note: NULL in non-prod
    p_language text DEFAULT 'en'::text,
    p_category_id text DEFAULT NULL::text,
    p_page integer DEFAULT 1,
    p_per_page integer DEFAULT 24,  -- Note: 20 in non-prod
    p_order_by text DEFAULT 'relevance'::text
)
RETURNS TABLE(
    image_id uuid,
    image_url text,
    thumbnail_url text,
    title text,
    description text,
    category_id text,
    category_name text,
    tags text[],
    width integer,
    height integer,
    relevance_score real,
    total_count bigint
)
LANGUAGE plpgsql
AS $function$
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
      ci.id AS img_id,
      ci.url AS img_url,
      ci.thumbnail_url AS img_thumbnail_url,
      COALESCE(cit.title, cit_en.title, 'Untitled') AS img_title,
      COALESCE(cit.description, cit_en.description, '') AS img_description,  -- FIXED
      ci.category_id AS img_category_id,
      COALESCE(cat_t.name, cat_t_en.name, ci.category_id, 'Uncategorized') AS img_category_name,
      COALESCE(cit.tags, cit_en.tags, ARRAY[]::TEXT[]) AS img_tags,
      ci.width AS img_width,
      ci.height AS img_height,
      CASE 
        WHEN p_query = '' THEN 0
        ELSE COALESCE(
          ts_rank(cit.search_vector, v_search_query),
          ts_rank(cit_en.search_vector, plainto_tsquery('english', p_query)),
          0
        )
      END AS rank,
      ci.created_at AS img_created_at,
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
  SELECT 
    img_id AS image_id,
    img_url AS image_url,
    img_thumbnail_url AS thumbnail_url,
    img_title AS title,
    img_description AS description,  -- FIXED
    img_category_id AS category_id,
    img_category_name AS category_name,
    img_tags AS tags,
    img_width AS width,
    img_height AS height,
    rank AS relevance_score,
    total AS total_count
  FROM filtered_images
  ORDER BY 
    CASE p_order_by
      WHEN 'latest' THEN img_created_at 
      ELSE img_created_at
    END DESC,
    rank DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$function$;
```

### Step 3: Cleanup Script (After Verification)
```sql
-- Only run after confirming everything works with category_id

BEGIN;

-- Final check before dropping
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN category = category_id THEN 1 END) as matching,
    COUNT(CASE WHEN category != category_id THEN 1 END) as mismatched
FROM custom_images;

-- Drop the category column if all good
ALTER TABLE custom_images DROP COLUMN category;

COMMIT;
```

## Testing Plan

### Before Migration
```sql
-- Baseline test with current functions
SELECT COUNT(*) FROM search_custom_images_i18n('emotions', 'en');
SELECT COUNT(*) FROM search_custom_images_vector('school', 'en');
```

### After Step 1 (Data Migration)
```sql
-- Verify data copied correctly
SELECT COUNT(*) FROM custom_images WHERE category_id IS NOT NULL;
SELECT COUNT(*) FROM custom_images WHERE category != category_id;
```

### After Step 2 (Function Updates)
```sql
-- Test functions work with category_id
SELECT * FROM search_custom_images_i18n('', 'en', 'emotions', 1, 10);
SELECT title, description, category_id FROM search_custom_images_i18n('', 'en', NULL, 1, 5);
```

### After Step 3 (Column Drop)
```sql
-- Ensure functions still work after dropping category
SELECT COUNT(*) FROM search_custom_images_i18n('', 'en');
```

## Rollback Plans

### Rollback Step 1
```sql
-- Clear category_id if needed
UPDATE custom_images SET category_id = NULL;
```

### Rollback Step 3
```sql
-- Re-add category column if needed (data would be lost)
ALTER TABLE custom_images ADD COLUMN category TEXT;
UPDATE custom_images SET category = category_id;
```

## Execution Order

1. **Test in Non-Production First**
   - Run Step 1 (data migration)
   - Run Step 2 (function updates)
   - Test thoroughly
   - Run Step 3 (drop column) if all good

2. **Apply to Production**
   - Same sequence after non-prod validation

## Notes
- Both environments have identical data (1,196 images, 14 categories)
- Functions have slight differences in defaults (prod: 24 per page, non-prod: 20)
- Category translations might not exist for all categories (need to verify)