import os
import json
import random
import re
import folder_paths
from typing import List, Dict, Tuple
from server import PromptServer
from aiohttp import web

class AP_Wildcards:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_input": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "Enter your prompt here..."
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "process"
    CATEGORY = "ap/utils"

    @classmethod
    def get_node_root_dir(cls) -> str:
        current_file_path = os.path.abspath(__file__)
        node_root_dir = os.path.dirname(os.path.dirname(current_file_path))
        return node_root_dir

    @classmethod
    def get_wildcards_directory(cls) -> str:
        node_root_dir = cls.get_node_root_dir()
        wildcards_dir = os.path.join(node_root_dir, "wildcards")
        return wildcards_dir

    @classmethod
    def get_templates_file(cls) -> str:
        node_root_dir = cls.get_node_root_dir()
        return os.path.join(node_root_dir, "templates.json")

    @classmethod
    def load_templates(cls) -> Dict[str, str]:
        templates_file = cls.get_templates_file()
        if os.path.exists(templates_file):
            try:
                with open(templates_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    @classmethod
    def save_templates(cls, templates: Dict[str, str]):
        templates_file = cls.get_templates_file()
        with open(templates_file, 'w', encoding='utf-8') as f:
            json.dump(templates, f, indent=2, ensure_ascii=False)

    @classmethod
    def scan_json_files(cls, directory: str, relative_folder: str = "") -> List[Tuple[str, str]]:
        json_files = []
        if not os.path.exists(directory):
            return json_files
        for item in os.listdir(directory):
            item_path = os.path.join(directory, item)
            new_relative_folder = os.path.join(relative_folder, item).replace('\\', '/') if relative_folder else item
            if os.path.isdir(item_path):
                json_files.extend(cls.scan_json_files(item_path, new_relative_folder))
            elif item.endswith('.json'):
                folder_path = relative_folder.replace('\\', '/')
                json_files.append((item_path, folder_path))
        return json_files

    @classmethod
    def load_all_wildcards(cls) -> Dict[str, List[str]]:
        wildcards_dir = cls.get_wildcards_directory()
        all_wildcards = {}
        if not os.path.exists(wildcards_dir):
            os.makedirs(wildcards_dir, exist_ok=True)
            example_file = os.path.join(wildcards_dir, "example.json")
            if not os.path.exists(example_file):
                example_data = {
                    "animals": ["cat", "dog", "elephant", "tiger"],
                    "colors": ["red", "green", "blue", "yellow"],
                    "styles": ["realistic", "cartoon", "abstract"]
                }
                with open(example_file, 'w', encoding='utf-8') as f:
                    json.dump(example_data, f, indent=2, ensure_ascii=False)
            return all_wildcards
        json_files = cls.scan_json_files(wildcards_dir)
        for filepath, folder in json_files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    base_name = os.path.splitext(os.path.basename(filepath))[0]
                    for category, values in data.items():
                        if isinstance(values, list):
                            if folder:
                                full_category = f"{folder}/{base_name}/{category}".replace('\\', '/')
                            else:
                                full_category = f"{base_name}/{category}".replace('\\', '/')
                            all_wildcards[full_category] = values
            except Exception as e:
                print(f"[AP-Wildcards] Error loading {filepath}: {e}")
        return all_wildcards

    @classmethod
    def get_wildcards_list(cls) -> List[str]:
        wildcards_dict = cls.load_all_wildcards()
        if not wildcards_dict:
            return []
        return sorted(wildcards_dict.keys())

    @classmethod
    def IS_CHANGED(cls, text_input):
        return random.random()

    def process(self, text_input: str):
        random.seed(int(random.random() * 1000000) % (2**32))
        wildcards_dict = self.load_all_wildcards()
        text_with_wildcards = self.replace_wildcards(text_input, wildcards_dict)
        result_text = self.process_braces(text_with_wildcards)
        return (result_text,)

    def replace_wildcards(self, text: str, wildcards_dict: Dict[str, List[str]]) -> str:
        pattern = r"__((?:[^_]|_(?!_))+?)__"
        def replacer(match):
            raw_category = match.group(1)
            category = raw_category.strip()
            if not category or all(c in ', ' for c in category):
                return match.group(0)
            if category in wildcards_dict:
                values = wildcards_dict[category]
                chosen = random.choice(values)
                return chosen
            else:
                alt_category = category.replace('\\', '/')
                if alt_category != category and alt_category in wildcards_dict:
                    values = wildcards_dict[alt_category]
                    chosen = random.choice(values)
                    return chosen
                return match.group(0)
        return re.sub(pattern, replacer, text)

    def process_braces(self, text: str) -> str:
        while True:
            match = re.search(r'\{([^{}]*)\}', text)
            if not match:
                break
            content = match.group(1)
            if '|' in content:
                parts = [p.strip() for p in content.split('|')]
                last_part = parts[-1]
                comma_pos = last_part.find(',')
                if comma_pos != -1:
                    suffix = last_part[comma_pos:]
                    options = parts[:-1] + [last_part[:comma_pos].strip()]
                    chosen = random.choice(options)
                    replacement = chosen + suffix
                else:
                    chosen = random.choice(parts)
                    replacement = chosen
            else:
                replacement = content
            text = text[:match.start()] + replacement + text[match.end():]
        return text

NODE_CLASS_MAPPINGS = {
    "AP-Wildcards": AP_Wildcards,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AP-Wildcards": "AP Wildcards Processor",
}

# API для шаблонов
@PromptServer.instance.routes.get("/ap-wildcards/templates")
async def get_templates(request):
    templates = AP_Wildcards.load_templates()
    return web.json_response(list(templates.keys()))

@PromptServer.instance.routes.post("/ap-wildcards/load_template")
async def load_template(request):
    data = await request.json()
    name = data.get("name")
    templates = AP_Wildcards.load_templates()
    content = templates.get(name, "")
    return web.json_response({"content": content})

@PromptServer.instance.routes.post("/ap-wildcards/save_template")
async def save_template(request):
    data = await request.json()
    name = data.get("name")
    content = data.get("content")
    if not name or content is None:
        return web.json_response({"error": "Missing name or content"}, status=400)
    templates = AP_Wildcards.load_templates()
    templates[name] = content
    AP_Wildcards.save_templates(templates)
    return web.json_response({"success": True})

@PromptServer.instance.routes.post("/ap-wildcards/delete_template")
async def delete_template(request):
    data = await request.json()
    name = data.get("name")
    if not name:
        return web.json_response({"error": "Missing name"}, status=400)
    templates = AP_Wildcards.load_templates()
    if name in templates:
        del templates[name]
        AP_Wildcards.save_templates(templates)
        return web.json_response({"success": True})
    else:
        return web.json_response({"error": "Template not found"}, status=404)