from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FILM = ROOT / "film"
MOBILE_VIEW = "--mobile-view" in sys.argv
FRAMES = FILM / ("frames-mobile" if MOBILE_VIEW else "frames")
OUT = FILM / "work-linkedin" / "frames"

SIZE = (1080, 1350)
VERTICAL = "--vertical" in sys.argv or MOBILE_VIEW
TARGET_SIZE = (1080, 1920) if VERTICAL else SIZE
BG = "#F2F7F6"
TEAL = "#0E8A7D"
DARK = "#101C2C"
MUTED = "#55706C"
ORANGE = "#FFB15C"
LIGHT = "#DDF8F3"
WITH_AGENT = "--with-agent" in sys.argv

FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def centered_x(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=fnt)
    return (SIZE[0] - (box[2] - box[0])) // 2


def fit_font(draw: ImageDraw.ImageDraw, text: str, start: int, width: int, bold=True):
    size = start
    while size > 25:
        fnt = font(size, bold)
        box = draw.textbbox((0, 0), text, font=fnt)
        if box[2] - box[0] <= width:
            return fnt
        size -= 2
    return font(size, bold)


def app_frame(source: Path, heading: str) -> Image.Image:
    if MOBILE_VIEW:
        image = Image.new("RGB", TARGET_SIZE, BG)
        draw = ImageDraw.Draw(image)
        draw.text((50, 62), "TOURFUCHS", fill=TEAL, font=font(34, True))
        right = "Echte Mobile-PWA"
        right_font = font(25)
        draw.text((TARGET_SIZE[0] - 50 - draw.textbbox((0, 0), right, font=right_font)[2], 70), right, fill=MUTED, font=right_font)
        heading_font = fit_font(draw, heading, 56, 980)
        draw.text((50, 165), heading, fill=DARK, font=heading_font)

        # Die Aufnahme bleibt unverfälscht im echten 9:16-Handyformat. Sie
        # wird weder seitlich beschnitten noch zu einer Desktopansicht gedehnt.
        screenshot = Image.open(source).convert("RGB").resize((900, 1600), Image.Resampling.LANCZOS)
        image.paste(screenshot, (90, 250))
        draw.rounded_rectangle((86, 246, 994, 1854), radius=22, outline="#70C9BD", width=4)
        draw.rounded_rectangle((50, 1885, 1030, 1897), radius=6, fill="#D5E4E1")
        draw.rounded_rectangle((50, 1885, 360, 1897), radius=6, fill=ORANGE)
        return image

    if VERTICAL:
        image = Image.new("RGB", TARGET_SIZE, BG)
        draw = ImageDraw.Draw(image)
        draw.text((50, 72), "TOURFUCHS", fill=TEAL, font=font(34, True))
        right = "Echte PWA-Oberfläche"
        right_font = font(25)
        draw.text((TARGET_SIZE[0] - 50 - draw.textbbox((0, 0), right, font=right_font)[2], 80), right, fill=MUTED, font=right_font)
        heading_font = fit_font(draw, heading, 58, 980)
        draw.text((50, 190), heading, fill=DARK, font=heading_font)

        draw.rounded_rectangle((20, 370, 1060, 955), radius=18, fill="#D8E4E1")
        screenshot = Image.open(source).convert("RGB").resize((1040, 585), Image.Resampling.LANCZOS)
        image.paste(screenshot, (20, 370))
        draw.rounded_rectangle((18, 368, 1062, 957), radius=20, outline="#70C9BD", width=4)

        detail = "Die echte TourFuchs-Oberfläche – im Film mit vollständig erfundenen Kunden."
        if heading.startswith("1."):
            detail = "Vorhandene Kundenliste einfügen – ohne ein neues Datensilo aufzubauen."
        elif heading.startswith("2."):
            detail = "Kunden als Gebiet verstehen – nicht nur als Zeilen in einer Liste."
        elif heading.startswith("3."):
            detail = "Mit einer Geste entsteht die Kundenauswahl für das Briefing."
        elif heading.startswith("4."):
            detail = "Ein Klick kopiert den fertigen Rechercheauftrag – ohne Tippen."
        elif heading.startswith("6.") or heading.startswith("5."):
            detail = "Du entscheidest, welche relevanten Kunden in die Tour kommen."
        elif heading.startswith("Tour"):
            detail = "TourFuchs bereitet vor. Die Reihenfolge bleibt deine Entscheidung."

        draw.rounded_rectangle((50, 1085, 1030, 1245), radius=28, fill="#E2F6F2")
        draw.rounded_rectangle((50, 1085, 65, 1245), radius=7, fill=TEAL)
        detail_font = fit_font(draw, detail, 32, 890, bold=False)
        detail_box = draw.textbbox((0, 0), detail, font=detail_font)
        draw.text((96, 1165 - (detail_box[3] - detail_box[1]) // 2), detail, fill=DARK, font=detail_font)

        pills = [("LOKAL", 95, 330), ("OPEN SOURCE", 375, 690), ("KI NACH WAHL", 735, 985)]
        for label, left, right_edge in pills:
            draw.rounded_rectangle((left, 1370, right_edge, 1440), radius=30, fill="#FFFFFF", outline="#BDD4CF", width=2)
            pill_font = fit_font(draw, label, 24, right_edge - left - 30)
            box = draw.textbbox((0, 0), label, font=pill_font)
            draw.text(((left + right_edge - (box[2] - box[0])) // 2, 1390), label, fill=TEAL, font=pill_font)

        footer = "Kundendaten bleiben lokal im Browser · abgesendet wird nur nach deinem Klick"
        footer_font = fit_font(draw, footer, 27, 980, bold=False)
        draw.text(((TARGET_SIZE[0] - draw.textbbox((0, 0), footer, font=footer_font)[2]) // 2, 1660), footer, fill="#49615D", font=footer_font)
        draw.rounded_rectangle((50, 1785, 1030, 1797), radius=6, fill="#D5E4E1")
        draw.rounded_rectangle((50, 1785, 360, 1797), radius=6, fill=ORANGE)
        return image

    image = Image.new("RGB", SIZE, BG)
    draw = ImageDraw.Draw(image)
    draw.text((50, 52), "TOURFUCHS", fill=TEAL, font=font(34, True))
    right = "Echte PWA-Oberfläche"
    right_font = font(25)
    draw.text((SIZE[0] - 50 - draw.textbbox((0, 0), right, font=right_font)[2], 60), right, fill=MUTED, font=right_font)
    heading_font = fit_font(draw, heading, 56, 980)
    draw.text((50, 145), heading, fill=DARK, font=heading_font)
    draw.rounded_rectangle((20, 345, 1060, 930), radius=18, fill="#D8E4E1")
    screenshot = Image.open(source).convert("RGB").resize((1040, 585), Image.Resampling.LANCZOS)
    image.paste(screenshot, (20, 345))
    draw.rounded_rectangle((18, 343, 1062, 932), radius=20, outline="#70C9BD", width=4)
    footer = "Echte PWA · erfundene Kunden · Verarbeitung lokal im Browser"
    footer_font = font(27)
    draw.text((centered_x(draw, footer, footer_font), 1045), footer, fill="#49615D", font=footer_font)
    draw.rounded_rectangle((50, 1135, 1030, 1145), radius=5, fill="#D5E4E1")
    draw.rounded_rectangle((50, 1135, 280, 1145), radius=5, fill=ORANGE)
    return image


def title_frame() -> Image.Image:
    if VERTICAL:
        image = Image.new("RGB", TARGET_SIZE, TEAL)
        draw = ImageDraw.Draw(image)
        for radius, alpha_color in [(520, "#169A8C"), (390, "#1CA394"), (260, "#24AA9B")]:
            draw.ellipse((800 - radius, 120 - radius, 800 + radius, 120 + radius), outline=alpha_color, width=3)
        draw.text((60, 90), "TOURFUCHS · OPEN SOURCE", fill="white", font=font(34, True))
        draw.multiline_text((60, 535), "Vom Excel-Blatt\nzum Kundenbriefing.", fill="white", font=font(78, True), spacing=22)
        draw.multiline_text((60, 850), "Gebiet einkreisen.\nPrompt kopieren.\nEntscheiden.", fill=LIGHT, font=font(44), spacing=18)
        draw.rounded_rectangle((60, 1170, 250, 1180), radius=5, fill=ORANGE)
        draw.text((60, 1710), "tourfuchs.vercel.app", fill="white", font=font(38, True))
        return image

    image = Image.new("RGB", SIZE, TEAL)
    draw = ImageDraw.Draw(image)
    for radius, alpha_color in [(420, "#169A8C"), (310, "#1CA394"), (210, "#24AA9B")]:
        draw.ellipse((760 - radius, 80 - radius, 760 + radius, 80 + radius), outline=alpha_color, width=3)
    draw.text((60, 70), "TOURFUCHS · OPEN SOURCE", fill="white", font=font(34, True))
    draw.multiline_text((60, 360), "Vom Excel-Blatt\nzum Kundenbriefing.", fill="white", font=font(76, True), spacing=18)
    draw.text((60, 650), "Gebiet einkreisen. Prompt kopieren. Entscheiden.", fill=LIGHT, font=font(36))
    draw.rounded_rectangle((60, 760, 230, 768), radius=4, fill=ORANGE)
    draw.text((60, 1160), "tourfuchs.vercel.app", fill="white", font=font(32))
    return image


def outro_frame() -> Image.Image:
    if VERTICAL:
        image = Image.new("RGB", TARGET_SIZE, DARK)
        draw = ImageDraw.Draw(image)
        draw.text((60, 90), "TOURFUCHS", fill="#72D8C9", font=font(34, True))
        draw.multiline_text((60, 430), "Eine Karte.\nEin Lasso.\nEin Prompt.", fill="white", font=font(92, True), spacing=22)
        draw.rounded_rectangle((60, 970, 250, 980), radius=5, fill=ORANGE)
        draw.text((60, 1080), "Kostenlos · Open Source · privates Projekt", fill="#C7D8D5", font=font(34))
        draw.text((60, 1410), "tourfuchs.vercel.app", fill="white", font=font(48, True))
        draw.text((60, 1500), "github.com/gunterstruck/tourfuchs", fill="#72D8C9", font=font(31))
        draw.text((60, 1745), "Alle gezeigten Kunden und Vorgänge sind erfunden.", fill="#9CB0AD", font=font(25))
        return image

    image = Image.new("RGB", SIZE, DARK)
    draw = ImageDraw.Draw(image)
    draw.text((60, 70), "TOURFUCHS", fill="#72D8C9", font=font(34, True))
    draw.multiline_text((60, 270), "Eine Karte.\nEin Lasso.\nEin Prompt.", fill="white", font=font(86, True), spacing=18)
    draw.rounded_rectangle((60, 690, 230, 698), radius=4, fill=ORANGE)
    draw.text((60, 760), "Kostenlos · Open Source · privates Projekt", fill="#C7D8D5", font=font(34))
    draw.text((60, 970), "tourfuchs.vercel.app", fill="white", font=font(46, True))
    draw.text((60, 1050), "github.com/gunterstruck/tourfuchs", fill="#72D8C9", font=font(31))
    draw.text((60, 1210), "Alle gezeigten Kunden sind erfunden.", fill="#9CB0AD", font=font(25))
    return image


def sales_agent_frame(answer: bool) -> Image.Image:
    """Ehrliche Filmillustration des Übergangs an eine vorhandene Unternehmens-KI.

    Es ist bewusst keine nachgebaute Copilot-Oberfläche: Ohne Firmenkonto zeigt
    die öffentliche Copilot-Seite nur eine Anmeldung, und ohne die internen
    Quellen könnte sie zu den Filmkunden nichts finden. Die Szene benennt daher
    klar, was Illustration und was echter TourFuchs-Ablauf ist.
    """
    image = Image.new("RGB", SIZE, BG)
    draw = ImageDraw.Draw(image)
    draw.text((50, 52), "TOURFUCHS", fill=TEAL, font=font(34, True))
    right = "Beispielansicht · erfundene Quellen"
    right_font = font(25)
    draw.text(
        (SIZE[0] - 50 - draw.textbbox((0, 0), right, font=right_font)[2], 60),
        right,
        fill=MUTED,
        font=right_font,
    )
    heading = "5. Sales Agent aus der Zwischenablage"
    draw.text((50, 145), heading, fill=DARK, font=fit_font(draw, heading, 56, 980))

    # Ein neutraler Browserrahmen: Er steht für die bereits vorhandene KI des
    # Nutzers, nicht für eine Verbindung von TourFuchs zu einem bestimmten
    # Anbieter.
    draw.rounded_rectangle((38, 270, 1042, 1110), radius=24, fill="#FFFFFF", outline="#BDD4CF", width=3)
    draw.rounded_rectangle((38, 270, 1042, 350), radius=24, fill="#E8F1EF")
    draw.rectangle((38, 326, 1042, 350), fill="#E8F1EF")
    for x, color in [(76, "#FF7B70"), (112, "#F4BE54"), (148, "#55C27A")]:
        draw.ellipse((x - 10, 300, x + 10, 320), fill=color)
    draw.rounded_rectangle((214, 290, 828, 331), radius=18, fill="#FFFFFF")
    draw.text((246, 298), "Unternehmens-KI / Sales Agent", fill=MUTED, font=font(23))
    draw.rounded_rectangle((855, 289, 1008, 332), radius=18, fill=LIGHT)
    draw.text((885, 298), "BEISPIEL", fill=TEAL, font=font(20, True))

    # Schmale Navigation wie in einem typischen Assistenten – bewusst ohne
    # Anbieterlogo oder täuschend echte Markenoberfläche.
    draw.rounded_rectangle((66, 388, 274, 1055), radius=18, fill="#102536")
    draw.text((94, 425), "KI-ASSISTENT", fill="#72D8C9", font=font(24, True))
    draw.text((94, 478), "Sales Agent", fill="white", font=font(30, True))
    draw.rounded_rectangle((88, 548, 252, 602), radius=18, fill="#1C3B4D")
    draw.text((112, 562), "Briefing", fill="white", font=font(24))
    draw.text((94, 978), "z. B. Microsoft 365\nCopilot", fill="#A9BFBA", font=font(21), spacing=7)

    content_x = 310
    if not answer:
        draw.text((content_x, 397), "Prompt eingefügt", fill=TEAL, font=font(30, True))
        draw.rounded_rectangle((content_x, 458, 1008, 861), radius=20, fill="#F4F8F7", outline="#D3E3E0", width=2)
        prompt_lines = [
            "Priorisiere die ausgewählten Kunden",
            "für meinen Besuchstag.",
            "",
            "Nutze meine freigegebenen Quellen.",
            "Erfinde nichts. Nenne offene Vorgänge",
            "und eine begründete Reihenfolge.",
        ]
        draw.multiline_text((342, 495), "\n".join(prompt_lines), fill=DARK, font=font(30), spacing=14)
        draw.rounded_rectangle((782, 902, 1008, 970), radius=24, fill=TEAL)
        draw.text((838, 920), "Senden  →", fill="white", font=font(26, True))
        draw.text((content_x, 1014), "Kein Buchstabe getippt.", fill=MUTED, font=font(24))
    else:
        draw.text((content_x, 397), "Priorität für die Tour", fill=TEAL, font=font(30, True))
        rows = [
            ("1", "Rheinstahl Fördertechnik", "Anlage steht · Rückmeldung überfällig"),
            ("2", "Emscher Anlagenbau", "Gutschrift offen · Bestellung blockiert"),
            ("3", "Sauerland Hydraulik", "Termin im August erbeten · Wettbewerb aktiv"),
        ]
        y = 460
        for rank, name, reason in rows:
            draw.rounded_rectangle((content_x, y, 1008, y + 142), radius=18, fill="#F4F8F7", outline="#D3E3E0", width=2)
            draw.ellipse((334, y + 38, 390, y + 94), fill=TEAL)
            rank_font = font(27, True)
            draw.text((362 - draw.textbbox((0, 0), rank, font=rank_font)[2] / 2, y + 48), rank, fill="white", font=rank_font)
            draw.text((414, y + 27), name, fill=DARK, font=font(27, True))
            draw.text((414, y + 78), reason, fill=MUTED, font=font(22))
            y += 160
        draw.rounded_rectangle((content_x, 958, 1008, 1032), radius=18, fill=LIGHT)
        draw.text((338, 981), "Antwort aus vollständig erfundenen Filmquellen", fill=TEAL, font=font(23, True))

    footer = "TourFuchs baut den Prompt lokal · abgesendet wird bewusst im gewählten Assistenten"
    footer_font = fit_font(draw, footer, 27, 980, bold=False)
    draw.text((centered_x(draw, footer, footer_font), 1195), footer, fill="#49615D", font=footer_font)
    draw.rounded_rectangle((50, 1260, 1030, 1270), radius=5, fill="#D5E4E1")
    draw.rounded_rectangle((50, 1260, 620, 1270), radius=5, fill=ORANGE)
    if VERTICAL:
        canvas = Image.new("RGB", TARGET_SIZE, BG)
        canvas.paste(image, (0, 215))
        canvas_draw = ImageDraw.Draw(canvas)
        canvas_draw.rounded_rectangle((50, 1650, 1030, 1760), radius=28, fill="#E2F6F2")
        note = "Prompt kopiert  →  Assistent deiner Wahl  →  du entscheidest"
        note_font = fit_font(canvas_draw, note, 30, 900, bold=True)
        note_box = canvas_draw.textbbox((0, 0), note, font=note_font)
        canvas_draw.text(((TARGET_SIZE[0] - (note_box[2] - note_box[0])) // 2, 1687), note, fill=TEAL, font=note_font)
        return canvas
    return image


def write(image: Image.Image, index: int):
    image.save(OUT / f"final-{index:04d}.jpg", quality=91, optimize=True, subsampling=0)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("final-*.jpg"):
        old.unlink()

    timeline_fps = 6 if MOBILE_VIEW else 2
    index = 1
    for _ in range(4 * timeline_fps):
        write(title_frame(), index)
        index += 1
    for _ in range(3 * timeline_fps):
        write(app_frame(FRAMES / "02-import.jpg", "1. Kundenliste einfügen"), index)
        index += 1
    for _ in range(3 * timeline_fps):
        write(app_frame(FRAMES / "03-datenanalyse.jpg", "2. Räumlich verstehen"), index)
        index += 1

    demo_sources = sorted(FRAMES.glob("demo-*.jpg"))
    if MOBILE_VIEW and len(demo_sources) > 1:
        # Das letzte Bild ist der technische Demo-Abschlussdialog und gehört
        # nicht in die Produktgeschichte; der eigene Abspann folgt ohnehin.
        demo_sources = demo_sources[:-1]
    main_frames = 45 * timeline_fps
    for out_index in range(main_frames):
        if MOBILE_VIEW:
            source_pos = round(out_index * (len(demo_sources) - 1) / max(1, main_frames - 1))
            source = demo_sources[source_pos]
        else:
            source_index = min(126, round(out_index * 1.4) + 1)
            source = FRAMES / f"demo-{source_index:04d}.jpg"
        t = out_index / timeline_fps
        if t < 10.7:
            heading = "3. Gebiet mit einer Geste auswählen"
        elif t < 23.6:
            heading = "4. Briefing-Prompt ohne Tippen erzeugen"
        elif t < 34.3:
            heading = "6. Relevante Kunden in die Tour nehmen" if WITH_AGENT else "5. Relevante Kunden in die Tour nehmen"
        else:
            heading = "Tour steht. Du entscheidest."
        write(app_frame(source, heading), index)
        index += 1

        # Genau an der Stelle, an der TourFuchs den Prompt kopiert, wechselt
        # der Film für acht Sekunden in den zweiten Browser: erst Einfügen,
        # dann die exemplarische Antwort. Danach geht dieselbe TourFuchs-
        # Auswahl weiter. Das Original bleibt ohne --with-agent unverändert.
        if WITH_AGENT and out_index == round(23.5 * timeline_fps):
            for agent_index in range(8 * timeline_fps):
                write(sales_agent_frame(answer=agent_index >= 2 * timeline_fps), index)
                index += 1

    for _ in range(6 * timeline_fps):
        write(outro_frame(), index)
        index += 1

    print(f"{index - 1} Filmframes gerendert")


if __name__ == "__main__":
    main()
