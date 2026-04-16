import os
import sys
import server
from aiohttp import web

WEB_DIRECTORY = "./web/js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

nodes_dir = os.path.join(os.path.dirname(__file__), "nodes")
if nodes_dir not in sys.path:
    sys.path.insert(0, nodes_dir)

from ap_wildcards import AP_Wildcards, NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

@server.PromptServer.instance.routes.get("/ap-wildcards/list")
async def get_wildcards_list(request):
    wildcards_list = AP_Wildcards.get_wildcards_list()
    return web.json_response(wildcards_list)