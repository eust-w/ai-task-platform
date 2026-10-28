"""Reflow title cards for platform-specific cover ratios, without cropping UI."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/launch"
OUT.mkdir(parents=True, exist_ok=True)

for name, (width, height) in {"3x4": (1080, 1440), "4x3": (1440, 1080)}.items():
    canvas = Image.new("RGB", (width, height), "#f4f5f6")
    draw = ImageDraw.Draw(canvas)

    def font(size):
        return ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", size)

    draw.rectangle((0, 0, width, 12), fill="#0f766e")
    draw.text((64, 60), "OPEN SOURCE / ALPHA", font=font(30), fill="#0f766e")
    draw.text((64, 135), "AI任务平台", font=font(92), fill="#18181b")
    draw.text((64, 260), "图片 · 对话 · 任务管理", font=font(40), fill="#52525b")
    image = Image.open(ROOT / "docs/images/workspace.jpg").convert("RGB")
    screen = ImageOps.contain(image, (width - 128, height - 550))
    canvas.paste(screen, ((width - screen.width) // 2, 360))
    draw.text((64, height - 140), "真实界面 / 合成配音 / 无生成演示", font=font(28), fill="#0f766e")
    draw.text((64, height - 80), "github.com/eust-w/ai-task-platform", font=font(25), fill="#52525b")
    canvas.save(OUT / f"cover-{name}.png")
