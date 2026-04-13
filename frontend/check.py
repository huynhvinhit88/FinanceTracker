import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'useAuth(' in content and 'import { useAuth }' not in content:
        print(f"[{filepath}] Missing useAuth import!")
        
    components = set(re.findall(r'<([A-Z]\w+)', content))
    imports_and_decls = content.split('return')[0]  # rough approximation to check before first return
    
    for comp in components:
        if comp not in imports_and_decls and f"function {comp}" not in content and f"const {comp}" not in content and f"class {comp}" not in content:
            print(f"[{filepath}] Might be missing definition for <{comp}>")
            
for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith('.jsx') or f.endswith('.js'):
            process_file(os.path.join(root, f))
