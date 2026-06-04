#!/bin/bash
# 获取完整教务响应
LOGIN=$(curl -s "http://localhost:3000/login?secret=emptyclassroom" -X POST -d "")
TOKEN=$(echo "$LOGIN" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['data']['token'])")
echo "TOKEN: ${TOKEN:0:30}..."
echo ""
echo "=== Campus 1 (西土城) ==="
curl -s "http://localhost:3000/query?campusId=01&secret=emptyclassroom" -H "token: $TOKEN" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Code:', d.get('code'))
print('Records:', len(d.get('data',[])))
for i, item in enumerate(d.get('data',[])[:3]):
    keys = list(item.keys())
    print(f'  [{i}] keys={keys}')
    for k,v in item.items():
        print(f'      {k}={str(v)[:200]}')
print('...')
print('Total items:', len(d.get('data',[])))
"
