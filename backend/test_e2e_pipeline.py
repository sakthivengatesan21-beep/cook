import urllib.request
import json
import time
from pathlib import Path

def run_e2e_pipeline_test():
    uploads_dir = Path(__file__).parent / "uploads"
    video_files = list(uploads_dir.glob("*.mp4"))
    if not video_files:
        print("[TEST] No mp4 video found in uploads/ directory.")
        return

    video_file = video_files[0]
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    data = bytearray()
    data.extend(f'--{boundary}\r\n'.encode('utf-8'))
    data.extend(f'Content-Disposition: form-data; name="file"; filename="{video_file.name}"\r\n'.encode('utf-8'))
    data.extend(b'Content-Type: video/mp4\r\n\r\n')
    with open(video_file, 'rb') as f:
        data.extend(f.read())
    data.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))

    print(f"[TEST] Uploading video {video_file.name}...")
    req = urllib.request.Request('http://127.0.0.1:8000/api/upload', data=data, method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    req.add_header('Authorization', 'Bearer cook_token_00000000-0000-0000-0000-000000000001')
    try:
        with urllib.request.urlopen(req) as res:
            resp_json = json.loads(res.read().decode())
            print('[TEST] Upload Result:', resp_json)

        video_id = resp_json['video_id']

        print(f"[TEST] Triggering process for {video_id}...")
        req_proc = urllib.request.Request(f'http://127.0.0.1:8000/api/process/{video_id}', data=b'{}', method='POST')
        req_proc.add_header('Content-Type', 'application/json')
        req_proc.add_header('Authorization', 'Bearer cook_token_00000000-0000-0000-0000-000000000001')
        with urllib.request.urlopen(req_proc) as res_proc:
            print('[TEST] Process Result:', json.loads(res_proc.read().decode()))

        print("[TEST] Polling status...")
        status_data = {}
        for i in range(40):
            time.sleep(2)
            req_status = urllib.request.Request(f'http://127.0.0.1:8000/api/process/{video_id}/status')
            with urllib.request.urlopen(req_status) as res_status:
                status_data = json.loads(res_status.read().decode())
                print(f"[{i*2}s] Status: {status_data.get('status')} | Progress: {status_data.get('progress')}% | Stage: {status_data.get('stage')} | Msg: {status_data.get('status_message')}")
                if status_data.get('status') in ['completed', 'failed']:
                    break

        print("[TEST] Finished polling. Final status:", status_data)
    except Exception as e:
        print(f"[TEST EXCEPTION] {e}")

if __name__ == "__main__":
    run_e2e_pipeline_test()
