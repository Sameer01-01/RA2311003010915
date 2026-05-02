# Notification System Design - Sameer Yadav (RA2311003010915)

## Stage 1: REST API Design

### Core Actions Supported:
- Get all notifications (paginated)
- Get unread notification count
- Mark single notification as read
- Mark all notifications as read
- Delete notification
- Send notification

### API Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications?page=1&limit=20` | Get paginated notifications |
| GET | `/api/notifications/unread/count` | Get count of unread notifications |
| PUT | `/api/notifications/:id/read` | Mark a notification as read |
| PUT | `/api/notifications/read-all` | Mark all notifications as read |
| DELETE | `/api/notifications/:id` | Delete a notification |
| POST | `/api/notifications` | Create a new notification |

### Request/Response Structures:

**GET /api/notifications?page=1&limit=20**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "Placement|Result|Event",
        "message": "Notification content",
        "isRead": false,
        "createdAt": "2026-05-02T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

**POST /api/notifications**
```json
// Request
{
  "studentId": "12345",
  "type": "Placement",
  "message": "New job opportunity at Google",
  "metadata": {}
}

// Response
{
  "success": true,
  "data": {
    "id": "generated-uuid",
    "createdAt": "2026-05-02T10:00:00Z"
  }
}
```

### Real-time Notification Mechanism:
- **Technology**: WebSockets (Socket.io)
- **Connection**: `ws://api.example.com/notifications`
- **Events**: `new_notification`, `notification_read`
- **Fallback**: Polling every 30 seconds if WebSockets fail

---

## Stage 2: Database Selection

**Chosen Database: PostgreSQL**

### Why PostgreSQL?
- **ACID Compliance** - Critical for notification delivery tracking
- **JSON Support** - Can store flexible metadata
- **Full-text Search** - For searching notifications
- **Row-level Security** - Student can only see their notifications
- **Mature & Reliable** - Production-proven

### Database Schema:
```sql
-- Students table
CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Placement', 'Result', 'Event')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_notifications_student_read ON notifications(student_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type_created ON notifications(type, created_at DESC);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Get paginated notifications for a student
SELECT * FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- Get unread count
SELECT COUNT(*) FROM notifications
WHERE student_id = $1 AND is_read = false;

-- Mark as read
UPDATE notifications
SET is_read = true, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND student_id = $2;
```

### Scaling Solutions as Data Volume Increases:

| Problem | Solution |
|---------|----------|
| Slow queries | Composite indexes, partitioning by date |
| Large table size | Table partitioning by `created_at` month |
| High write load | Write-ahead logging, batch inserts |
| Read replicas | Master-slave replication for analytics |
| Connection pooling | PgBouncer to manage 10k+ connections |
| Archival | Move old notifications (>6 months) to cold storage |

---

## Stage 3: Query Optimization Analysis

### Original Query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

### Is this query accurate?
Yes - It correctly fetches all unread notifications for student 1042, ordered by newest first.

### Why is it slow?
- No index on `studentID` - Full table scan
- No composite index - Can't efficiently filter by both columns
- `SELECT *` - Retrieves unnecessary columns (bloat)
- Large table - 5M notifications scanned

### Recommended Changes:
```sql
-- Create composite index
CREATE INDEX idx_notif_student_read_date
ON notifications(studentID, isRead, createdAt DESC);

-- Optimized query
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC
LIMIT 50;
```

### Computation Cost:
- **Before**: O(n) full table scan - ~5M rows scanned
- **After**: O(log n) index seek - ~50-100 rows scanned
- **Improvement**: 99.99% reduction in I/O

### Is "index on every column" effective?
**NO!** Why:
- Writes become 5-10x slower (each insert updates all indexes)
- Storage grows significantly (~50% more disk space)
- Query optimizer gets confused (too many options)
- **Best practice**: Create targeted composite indexes based on query patterns

### Query for placement notifications in last 7 days:
```sql
SELECT student_id, COUNT(*) as notification_count
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY student_id
ORDER BY notification_count DESC;
```

---

## Stage 4: Performance Improvement Strategies

### Problem: DB overwhelmed, fetching notifications on every page load

| Strategy | How it works | Tradeoffs |
|----------|-------------|-----------|
| Redis Cache | Cache notifications for 1 minute | + 10x faster, - Stale data possible |
| Pagination | Load 20 at a time, not all | + Reduces payload, - Extra requests |
| Lazy Loading | Load only visible notifications | + Less initial load, - More complex UI |
| Read Replicas | Dedicate replica for reads | + Scales horizontally, - Replication lag |
| CDN Edge Caching | Cache for anonymous users | + Global low latency, - Auth complexity |

### Recommended Architecture:
```
[Student App] → [API Gateway] → [Redis Cache] → [PostgreSQL Master]
                                    ↓
                            [PostgreSQL Replica] (for analytics)
```

### Implementation Steps:
1. Add Redis cache with 60-second TTL
2. Implement cursor-based pagination
3. Add connection pool (max 20 connections)
4. Use materialized views for dashboard
5. Implement read replicas for scaling

---

## Stage 5: Batch Notification Redesign

### Problems with Original Implementation:
- Sequential processing - 50,000 emails one by one (very slow)
- No transaction - Email failure doesn't rollback DB
- No retry mechanism - Failed emails lost forever
- Single point of failure - One error stops everything
- No tracking - Can't see which students got what

### Redesigned Solution:

```python
import asyncio
from celery import Celery
from redis import Redis
from typing import List, Dict
import uuid
import logging

app = Celery('notifications', broker='redis://localhost:6379', backend='redis://localhost:6379')
redis_client = Redis(decode_responses=True)

class BatchNotificationService:

    def __init__(self):
        self.BATCH_KEY_PREFIX = "batch:"
        self.FAILED_KEY_PREFIX = "failed:"

    def notify_all(self, student_ids: List[str], message: str) -> str:
        """Main entry point - non-blocking"""
        batch_id = str(uuid.uuid4())
        batch_data = {
            "batch_id": batch_id,
            "total_students": len(student_ids),
            "message": message,
            "status": "processing"
        }
        redis_client.hset(f"{self.BATCH_KEY_PREFIX}{batch_id}", mapping=batch_data)

        chunk_size = 1000
        for i in range(0, len(student_ids), chunk_size):
            chunk = student_ids[i:i+chunk_size]
            self.send_batch_chunk.delay(batch_id, chunk, message, i)

        return batch_id

    @app.task(bind=True, max_retries=3)
    def send_batch_chunk(self, batch_id, student_ids, message, offset):
        results = {"success": [], "failed": []}
        for student_id in student_ids:
            try:
                success = self.process_student_notification(student_id, message)
                if success:
                    results["success"].append(student_id)
                else:
                    results["failed"].append(student_id)
            except Exception as e:
                results["failed"].append(student_id)
        redis_client.hincrby(f"{self.BATCH_KEY_PREFIX}{batch_id}", "completed", len(results["success"]))
        if results["failed"]:
            redis_client.sadd(f"{self.FAILED_KEY_PREFIX}{batch_id}", *results["failed"])
        return results

    def process_student_notification(self, student_id, message):
        with asyncio.ThreadPoolExecutor() as executor:
            email_future = executor.submit(self.send_email, student_id, message)
            db_future = executor.submit(self.save_to_db, student_id, message)
            push_future = executor.submit(self.push_to_app, student_id, message)
            return all([email_future.result(timeout=10),
                        db_future.result(timeout=5),
                        push_future.result(timeout=5)])

    def retry_failed(self, batch_id):
        failed_ids = redis_client.smembers(f"{self.FAILED_KEY_PREFIX}{batch_id}")
        for student_id in failed_ids:
            success = self.process_student_notification(student_id,
                redis_client.hget(f"{self.BATCH_KEY_PREFIX}{batch_id}", "message"))
            if success:
                redis_client.srem(f"{self.FAILED_KEY_PREFIX}{batch_id}", student_id)

    def get_batch_status(self, batch_id):
        data = redis_client.hgetall(f"{self.BATCH_KEY_PREFIX}{batch_id}")
        return {
            "batch_id": batch_id,
            "total": int(data.get("total_students", 0)),
            "completed": int(data.get("completed", 0)),
            "failed": redis_client.scard(f"{self.FAILED_KEY_PREFIX}{batch_id}"),
            "status": data.get("status", "unknown")
        }
```

### Key Improvements:

| Issue | Original | Redesigned |
|-------|----------|------------|
| Speed | Sequential (50k iterations) | Parallel chunks + async |
| Failure handling | Stopped at first error | Continue + retry failed |
| Email failures | Lost forever | Stored in Redis for retry |
| Visibility | No tracking | Real-time status API |
| Scalability | Single server | Distributed via Celery |
| Transaction | None | DB save independent of email |

### Should DB save and email happen together?
**NO** - They should NOT be coupled because:
- Email failures shouldn't block DB storage
- You can retry emails later without touching DB
- Users see notification in-app immediately even if email delayed
- Better user experience (notification appears instantly)

---

## Stage 6: Priority Inbox Implementation

### Approach Explanation:

**Priority Score Formula:**
```
Score = (Weight × 10) + RecencyFactor

Where:
  Weight:        Placement=3, Result=2, Event=1
  RecencyFactor: (604800 - age_in_seconds) / 60480
                 Range: 0-10, newer = higher
```

### Algorithm Used: Min-Heap for maintaining Top-N

**Why Min-Heap?**
- O(log n) insertion time
- O(1) access to smallest in top-N
- Efficient for streaming notifications

### Efficient Top-10 Maintenance:
```javascript
class MinHeap {
    constructor(size) {
        this.heap = [];
        this.maxSize = size;
    }

    insert(notification, score) {
        if (this.heap.length < this.maxSize) {
            this.heap.push({ notification, score });
            this.bubbleUp(this.heap.length - 1);
        } else if (score > this.heap[0].score) {
            this.heap[0] = { notification, score };
            this.sinkDown(0);
        }
    }
}

// For each new notification:
// 1. Calculate priority score
// 2. If higher than smallest in heap, replace
// 3. Re-heapify → Always top N without sorting all!
```

### Code Implementation:
Full working code is in `notification_app_be/priorityInbox.js`:
- `getTopNotifications(n)` — Returns top N from all notifications
- `PriorityInboxCache` — Maintains top N efficiently for streaming
- `calculatePriorityScore()` — Implements the scoring formula

### Complexity Analysis:

| Operation | Time Complexity | Space |
|-----------|----------------|-------|
| Initial fetch & sort | O(n log n) | O(n) |
| New notification (heap) | O(log k) where k=10 | O(k) |
| Get top N | O(1) | O(k) |
