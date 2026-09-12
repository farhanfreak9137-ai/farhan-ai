import os
import re

log_path = 'data/voice_assistant.log'
history_path = 'data/voice_command_history.txt'

if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    entries = []
    current_time = ''

    for line in lines:
        m_time = re.match(r'^\[([\d\-: ]+)\]', line)
        if m_time:
            current_time = m_time.group(1)

        if 'Wake word detected:' in line:
            m = re.search(r"in '([^']+)'", line)
            if m:
                entries.append(f'[{current_time}] Farhan: "{m.group(1)}"')
        elif 'Received follow-up command:' in line or 'Received command:' in line or 'Executing one-shot command:' in line:
            m = re.search(r'"([^"]+)"', line)
            if m:
                entries.append(f'[{current_time}] Farhan: "{m.group(1)}"')
        elif '🔊 Auren: "' in line or 'Auren: "' in line:
            m = re.search(r'Auren: "([^"]+)"', line)
            if m:
                entries.append(f'[{current_time}] Auren: "{m.group(1)}"')
                entries.append('-' * 50)

    with open(history_path, 'w', encoding='utf-8') as hf:
        hf.write('=== AUREN VOICE COMMAND & CONVERSATION HISTORY ===\n\n')
        hf.write('\n'.join(entries))
        hf.write('\n')

    print(f'Exported {len(entries)} items to {history_path}')
