import asyncio
import json
import httpx
from app.core.database import init_db
from app.main import app

async def run_tests():
    await init_db()
    # Use httpx AsyncClient with ASGITransport to test the FastAPI app directly in-memory
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/health")
        print("Health Check Status:", res.status_code)
        print("Health Check Response:", res.json())
        assert res.status_code == 200

        # 2. Models
        res = await client.get("/api/models")
        print("Models Status:", res.status_code)
        print("Models Response:", res.json())
        assert res.status_code == 200

        # 3. Create Conversation
        res = await client.post("/api/conversations", json={"title": "Test Chat"})
        print("Create Conversation Status:", res.status_code)
        conv_data = res.json()
        print("Created Conversation:", conv_data["id"], conv_data["title"])
        assert res.status_code == 201
        conv_id = conv_data["id"]

        # 4. List Conversations
        res = await client.get("/api/conversations")
        print("List Conversations Count:", len(res.json()))
        assert len(res.json()) >= 1

        # 5. Chat Streaming SSE
        print("\nTesting Chat SSE stream:")
        async with client.stream("POST", "/api/chat", json={"message": "Hello Solix", "conversation_id": conv_id}) as stream_res:
            assert stream_res.status_code == 200
            print("Chat Stream Status:", stream_res.status_code)
            tokens = []
            async for line in stream_res.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    event_type = event.get("type")
                    if event_type == "token":
                        tokens.append(event.get("content", ""))
                    elif event_type == "done":
                        print(f"SSE Done event received! Message ID: {event.get('message_id')}")
            print(f"Total tokens received: {len(tokens)}")
            preview_text = ''.join(tokens)[:150].encode('ascii', errors='replace').decode('ascii')
            print(f"Preview of generated response:\n{preview_text}...")

        # 6. Verify Conversation Detail has messages
        res = await client.get(f"/api/conversations/{conv_id}")
        assert res.status_code == 200
        detail = res.json()
        print(f"Messages stored in conversation {conv_id}: {len(detail['messages'])}")
        assert len(detail["messages"]) == 2  # 1 user + 1 assistant

        # 7. Delete Conversation
        res = await client.delete(f"/api/conversations/{conv_id}")
        assert res.status_code == 200
        print("Conversation deleted successfully.")

        # 8. Test Web Search route graceful handling (when TAVILY_API_KEY is not set)
        print("\nTesting Web Search route handling:")
        async with client.stream(
            "POST",
            "/api/chat",
            json={"message": "What is the latest RTX GPU?", "web_search": True},
        ) as stream:
            assert stream.status_code == 200
            web_events = []
            async for line in stream.aiter_lines():
                if line.startswith("data: "):
                    web_events.append(json.loads(line[6:]))
            # First event should be start with web_search: True
            assert web_events[0]["type"] == "start"
            assert web_events[0].get("web_search") is True
            # Second event will be error if no API key is configured, which is graceful
            print(f"Web search correctly started, events yielded: {[e['type'] for e in web_events]}")

        # 9. Test Root Dashboard HTML Page
        print("\nTesting Backend Dashboard (GET /):")
        res = await client.get("/")
        assert res.status_code == 200
        assert "text/html" in res.headers.get("content-type", "")
        assert "Solix Backend" in res.text
        assert "solix-logo.png" in res.text
        print("Root dashboard HTML successfully loaded.")

        # 10. Test Root Machine-Readable Health (GET /health)
        print("\nTesting Root Machine-Readable Health (GET /health):")
        res = await client.get("/health")
        assert res.status_code == 200
        health_data = res.json()
        assert "status" in health_data
        assert "streaming" in health_data
        assert health_data["streaming"] == "enabled"
        print(f"Root health verified: status={health_data['status']}, ollama={health_data.get('ollama')}")

        # 11. Test Static Logo Asset
        print("\nTesting Static Logo Asset (GET /static/solix-logo.png):")
        res = await client.get("/static/solix-logo.png")
        assert res.status_code == 200
        assert "image/png" in res.headers.get("content-type", "")
        print(f"Static logo verified: {len(res.content)} bytes received.")

        # 12. Test Dashboard Status & Stats Endpoints
        print("\nTesting Dashboard Status & Stats API:")
        res_status = await client.get("/api/dashboard/status")
        assert res_status.status_code == 200
        dash_status = res_status.json()
        assert "services" in dash_status
        assert "models" in dash_status
        assert "uptime_seconds" in dash_status
        print(f"Dashboard status verified: {dash_status['services']}")

        res_stats = await client.get("/api/dashboard/stats")
        assert res_stats.status_code == 200
        dash_stats = res_stats.json()
        assert "total_requests" in dash_stats
        assert dash_stats["total_requests"] > 0
        print(f"Dashboard stats verified: total={dash_stats['total_requests']}, successful={dash_stats['successful_requests']}")

        # 13. Test Dashboard Logs API
        print("\nTesting Dashboard Logs API:")
        res_logs = await client.get("/api/dashboard/logs")
        assert res_logs.status_code == 200
        dash_logs = res_logs.json()
        assert "logs" in dash_logs
        assert len(dash_logs["logs"]) > 0
        print(f"Dashboard logs verified: {dash_logs['count']} logs recorded in memory buffer.")

    print("\n--- ALL BACKEND TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    asyncio.run(run_tests())
