package githubsource

import (
	"sync"
	"time"
)

type cacheEntry struct {
	data      *ListContentsResult
	expiresAt time.Time
}

type ttlCache struct {
	mu    sync.RWMutex
	items map[string]*cacheEntry
	order []string
	ttl   time.Duration
	max   int
}

func newTTLCache(ttl time.Duration, max int) *ttlCache {
	return &ttlCache{
		items: make(map[string]*cacheEntry),
		order: make([]string, 0, max),
		ttl:   ttl,
		max:   max,
	}
}

func (c *ttlCache) get(key string) (*ListContentsResult, bool) {
	c.mu.RLock()
	entry, ok := c.items[key]
	c.mu.RUnlock()
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.items, key)
		c.removeOrder(key)
		c.mu.Unlock()
		return nil, false
	}
	return entry.data, true
}

func (c *ttlCache) set(key string, data *ListContentsResult) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.items[key]; !exists {
		if len(c.items) >= c.max {
			oldest := c.order[0]
			delete(c.items, oldest)
			c.order = c.order[1:]
		}
		c.order = append(c.order, key)
	}

	c.items[key] = &cacheEntry{
		data:      data,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *ttlCache) removeOrder(key string) {
	for i, k := range c.order {
		if k == key {
			c.order = append(c.order[:i], c.order[i+1:]...)
			return
		}
	}
}

func (c *ttlCache) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]*cacheEntry)
	c.order = make([]string, 0, c.max)
}
