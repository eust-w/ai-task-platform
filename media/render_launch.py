"""Render a factual UI introduction. Requires Pillow, FFmpeg and macOS say.

Screenshots are real local UI captures, not generated model outputs. No music or
external media is used. Narration is synthesized and visibly disclosed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FPS = 30
SCENES = [
    ("AI任务平台", "图片、对话与任务管理", "workspace", [
        ("这是 AI 任务平台，一个可以自行部署的图片与对话工作区。", "AI Task Platform: a self-hosted image and chat workspace."),
        ("把调用入口、任务记录和文件管理，放在同一个地方。", "Keep requests, task records and downloads in one place."),
    ]),
    ("从文字，到参考图", "文生图 / 最多八张参考图片", "references", [
        ("图片创作提供文生图和参考图编辑，支持选择多张参考图片。", "Create images from text, or select multiple reference images."),
        ("画面中的参考图是界面截图，不是模型生成结果。", "These references are UI captures, not model-generated results."),
    ]),
    ("对话，也有任务记录", "文本对话 / 按用户隔离", "chat", [
        ("文本对话与图片任务共用用户身份，任务按用户隔离。", "Chat and image tasks share user-scoped access controls."),
        ("当前版本支持普通文本对话，不执行工具或任意命令。", "This Alpha supports text chat, not tools or arbitrary commands."),
    ]),
    ("每个 Key，独立限额", "日额度 / 并发数 / 提交间隔", "settings", [
        ("管理员可以创建和停用用户密钥，分别设置日额度、并发数和提交间隔。", "Create or disable keys, with quotas, concurrency and request intervals."),
        ("登录密钥只留在页面内存中，不写入浏览器的持久存储。", "Login credentials stay in page memory, not persistent browser storage."),
    ]),
    ("文件不是公开链接", "鉴权下载 / 可选历史记录", "downloads", [
        ("生成文件需要所属用户鉴权才能下载，任务可以重命名、备注和删除。", "Downloads require owner authentication; tasks can be renamed, annotated or deleted."),
        ("关闭历史记录不等于零痕迹，保留范围在安全文档中明确说明。", "History off does not mean zero retention. The security guide explains the limits."),
    ]),
    ("公开代码，明确边界", "github.com/eust-w/ai-task-platform", "workspace", [
        ("开源版使用正式授权的模型 API，不包含账号池或订阅转售网关。", "Use your authorized model API. No account pools or subscription gateway."),
        ("这是阿尔法版。本片展示真实界面，使用合成配音，未进行付费模型生成演示。", "Alpha. Real UI, synthetic narration. No paid-provider generation is demonstrated."),
        ("代码、测试和部署说明都在仓库中，欢迎审阅和贡献。", "Code, tests and deployment guides are available for review and contribution."),
    ]),
]


def run(args):
    subprocess.run([str(x) for x in args], check=True, stdout=subprocess.DEVNULL)


def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], text=True))


def wrap(draw, text, font, width):
    words, separator = (text.split(), " ") if text.isascii() else (list(text), "")
    lines, line = [], ""
    for word in words:
        candidate = line + (separator if line else "") + word
        if line and draw.textlength(candidate, font=font) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + [line]


def stamp(seconds):
    value = round(seconds * 1000)
    return f"{value // 3600000:02}:{value // 60000 % 60:02}:{value // 1000 % 60:02},{value % 1000:03}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screens", type=Path, default=ROOT / "docs/images")
    parser.add_argument("--output", type=Path, default=ROOT / "output/launch")
    parser.add_argument("--font", default="/System/Library/Fonts/Hiragino Sans GB.ttc")
    parser.add_argument("--voice", default="Tingting")
    parser.add_argument("--rate", default=205, type=int)
    args = parser.parse_args()
    build = args.output / "render"
    build.mkdir(parents=True, exist_ok=True)
    font = lambda size: ImageFont.truetype(args.font, size)
    durations, cues, elapsed = [], [], 0.0
    for index, (_, _, _, sentences) in enumerate(SCENES):
        paths, local = [], 0.0
        for number, (zh, en) in enumerate(sentences):
            path = build / f"voice-{index}-{number}.aiff"
            run(["say", "-v", args.voice, "-r", args.rate, "-o", path, zh])
            seconds = duration(path)
            cues.append(dict(scene=index, start=elapsed + local, end=elapsed + local + seconds, zh=zh, en=en))
            local += seconds
            paths.append(path)
        concat = build / f"voice-{index}.txt"
        concat.write_text("\n".join(f"file '{p.name}'" for p in paths) + "\n")
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concat, "-af", "apad=pad_dur=0.5,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", build / f"voice-{index}.wav"])
        seconds = math.ceil((local + 0.5) * FPS) / FPS
        durations.append(seconds)
        elapsed += seconds
    for language in ("zh", "en"):
        (args.output / f"AI-Task-Platform.{language}.srt").write_text("\n\n".join(f"{i+1}\n{stamp(c['start'])} --> {stamp(c['end'])}\n{c[language]}" for i, c in enumerate(cues)) + "\n")
    outputs = []
    for orientation in ("landscape", "portrait"):
        portrait = orientation == "portrait"
        width, height = (1080, 1920) if portrait else (1920, 1080)
        margin = 64
        screen_box = (64, 410, 952, 970) if portrait else (64, 225, 1792, 610)
        clips, elapsed = [], 0.0
        for index, (title, detail, stem, _) in enumerate(SCENES):
            plate = Image.new("RGB", (width, height), "#f4f5f6")
            draw = ImageDraw.Draw(plate)
            draw.rectangle((0, 0, width, 8), fill="#0f766e")
            draw.text((margin, 40), "AI TASK PLATFORM", font=font(25), fill="#0f766e")
            draw.text((width-240, 40), "ALPHA 0.1", font=font(24), fill="#52525b")
            for line_no, line in enumerate(wrap(draw, title, font(64), width - 2 * margin)):
                draw.text((margin, 110 + line_no * 85), line, font=font(64), fill="#18181b")
            for line_no, line in enumerate(wrap(draw, detail, font(28), width - 2 * margin)):
                draw.text((margin, 205 if portrait else 186 + line_no * 42), line, font=font(28), fill="#52525b")
            x, y, sw, sh = screen_box
            source = Image.open(args.screens / f"{stem}.jpg").convert("RGB")
            fitted = ImageOps.contain(source, (sw, sh))
            plate.paste(fitted, (x + (sw-fitted.width)//2, y + (sh-fitted.height)//2))
            if portrait:
                draw.text((margin, 1420), "真实界面 · 未配置模型 API", font=font(30), fill="#0f766e")
            draw.text((margin, height-70), f"{index+1:02}/06  真实界面截图 · 合成配音", font=font(22), fill="#52525b")
            plate_path = build / f"{orientation}-{index}.png"
            plate.save(plate_path)
            if index == 0:
                plate.save(args.output / f"cover-{orientation}.png")
            cmd = ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", FPS, "-i", plate_path]
            filters, current, count = [], "0:v", 1
            for number, cue in enumerate(c for c in cues if c["scene"] == index):
                caption = Image.new("RGBA", (width, 350 if portrait else 160), (0, 0, 0, 0))
                painter, cursor = ImageDraw.Draw(caption), 0
                for language, size, color in (("zh", 39 if portrait else 34, "#18181b"), ("en", 26 if portrait else 25, "#52525b")):
                    for line in wrap(painter, cue[language], font(size), width - 2 * margin):
                        painter.text(((width-painter.textlength(line, font=font(size))) / 2, cursor), line, font=font(size), fill=color)
                        cursor += size + 14
                    cursor += 8
                if cursor > caption.height:
                    raise ValueError(f"Caption overflow: {orientation}/{index}/{number}")
                path = build / f"caption-{orientation}-{index}-{number}.png"
                caption.save(path)
                cmd += ["-loop", "1", "-framerate", FPS, "-i", path]
                label = f"caption{number}"
                filters.append(f"[{current}][{count}:v]overlay=0:{1500 if portrait else 870}:enable='between(t,{cue['start']-elapsed:.4f},{cue['end']-elapsed:.4f})'[{label}]")
                current, count = label, count+1
            cmd += ["-i", build / f"voice-{index}.wav"]
            seconds = durations[index]
            filters.append(f"[{current}]fade=t=in:st=0:d=0.15,fade=t=out:st={seconds-0.15:.4f}:d=0.15,format=yuv420p[v]")
            clip = build / f"{orientation}-{index}.mp4"
            run(cmd + ["-filter_complex", ";".join(filters), "-map", "[v]", "-map", f"{count}:a", "-af", "apad", "-t", seconds, "-r", FPS, "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-threads", "3", "-c:a", "aac", "-b:a", "192k", clip])
            clips.append(clip)
            elapsed += seconds
            print(f"{orientation}: {index+1}/{len(SCENES)}", flush=True)
        concat = build / f"{orientation}.txt"
        concat.write_text("\n".join(f"file '{p.name}'" for p in clips) + "\n")
        target = args.output / f"AI-Task-Platform-{orientation}-1080p.mp4"
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-movflags", "+faststart", target])
        outputs.append(dict(file=target.name, width=width, height=height, duration=duration(target), sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    (args.output / "manifest.json").write_text(json.dumps(dict(outputs=outputs, synthetic_voice=True, real_ui=True, paid_provider_generation=False, cues=cues), ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
