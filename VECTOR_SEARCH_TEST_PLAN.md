# Vector Search Test Plan

## Deployment Status
- ✅ Backend code pushed to `develop` branch
- ✅ Auto-deployment to dev environment triggered
- ✅ Database functions deployed to both prod and non-prod
- ⏳ Waiting for Zuplo deployment completion

## Dev Environment
- **URL**: https://unico-api-develop-551bdfd.d2.zuplo.dev
- **Endpoint**: `/v1/images/search`
- **Auth**: Requires Clerk JWT token

## Test Scenarios

### 1. Verify AI Binding
Check Zuplo logs for:
- `context.env.AI` availability
- BGE-M3 model access (`@cf/baai/bge-m3`)
- Embedding generation attempts

### 2. Text Search Fallback
Test that search works even without embeddings:
```javascript
// Query without embeddings (AI not available)
fetch('/v1/images/search?query=children&lang=en&provider=custom')
```

### 3. Vector Search (if AI binding works)
Test semantic similarity across languages:

#### English Queries
- "angry child" - Should find emotion-related images
- "children playing" - Should find social/activity images  
- "school classroom" - Should find education images
- "happy family" - Should find people/emotion images

#### Spanish Queries (should find similar results)
- "niño enojado" - Should match "angry child" results
- "niños jugando" - Should match "children playing" results
- "aula escolar" - Should match "school classroom" results
- "familia feliz" - Should match "happy family" results

### 4. Performance Metrics
Monitor in Zuplo dashboard:
- Embedding generation time (target: <300ms)
- Total search time (target: <600ms)
- Cache hit rate (5-minute TTL on embeddings)

## Testing from Frontend

### Using Browser Console
```javascript
// Get the API client (assuming it's available globally)
const testSearch = async (query, lang) => {
  const response = await fetch(
    `${API_BASE_URL}/v1/images/search?` + new URLSearchParams({
      query: query,
      lang: lang,
      provider: 'custom',
      perPage: '10'
    }),
    {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  console.log(`Query: "${query}" (${lang})`);
  console.log(`Total results: ${data.total}`);
  console.log('First 3 results:', data.images?.slice(0, 3).map(img => ({
    title: img.metadata?.title,
    category: img.metadata?.category,
    score: img.metadata?.relevance_score
  })));
  
  return data;
};

// Test multilingual similarity
await testSearch('angry child', 'en');
await testSearch('niño enojado', 'es');
```

### Using the UI
1. Navigate to the image search dialog
2. Switch between English and Spanish languages
3. Search for the same concept in both languages
4. Compare results - they should be semantically similar

## Verification Checklist

### Backend Health
- [ ] `/v1/images/search` endpoint responds
- [ ] Clerk authentication works
- [ ] CORS headers present

### Embedding Generation
- [ ] Check Zuplo logs for `Generating query embedding` messages
- [ ] Verify no `Cloudflare AI binding not configured` errors
- [ ] Confirm `generateEmbeddingInline` is being called

### Search Quality
- [ ] Text search works (baseline)
- [ ] Multilingual queries return similar results
- [ ] Relevance scores are meaningful (0.3-1.0 range)
- [ ] Results are properly ranked by similarity

### Error Handling
- [ ] Search works even if embedding fails
- [ ] Proper fallback to text search
- [ ] No 500 errors in any scenario

## Monitoring

### Zuplo Dashboard
- Check request logs
- Monitor error rates
- Review performance metrics

### Database Queries
```sql
-- Check if embeddings are being used
SELECT 
  COUNT(*) as search_count,
  p_use_vector as using_embeddings,
  DATE_TRUNC('hour', created_at) as hour
FROM search_logs  -- If logging is enabled
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY p_use_vector, hour
ORDER BY hour DESC;
```

## Next Steps After Testing

1. **If AI binding not working:**
   - Check Zuplo environment configuration
   - Verify Cloudflare Workers AI is enabled
   - Check AI binding name matches code

2. **If working but slow:**
   - Implement caching at API gateway level
   - Consider pre-computing common query embeddings
   - Optimize database indexes

3. **If working well:**
   - Proceed with Phase 3 (Frontend Integration)
   - Add language toggle UI
   - Implement client-side caching