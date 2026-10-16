"""Generate 3 fake test resumes for DevProof.
Usage: python make_resumes.py <github-username>
Writes resume_a.pdf (visible link), resume_b.pdf (hyperlink only), resume_c_scanned.pdf (image only).
"""
import subprocess, sys, tempfile, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from PIL import Image

user = sys.argv[1] if len(sys.argv) > 1 else "YOUR-USERNAME"
repo_url = f"https://github.com/{user}/student-api"
ss = getSampleStyleSheet()
H = ParagraphStyle("H", parent=ss["Heading2"], spaceBefore=10, spaceAfter=4)
B = ss["BodyText"]

def build(path, link_mode):
    link = (f'<a href="{repo_url}" color="blue">GitHub</a>' if link_mode == "hyperlink"
            else f"github.com/{user}/student-api")
    story = [
        Paragraph("Asha Verma", ss["Title"]),
        Paragraph("Aspiring backend engineer | asha.verma@example.com", B),
        Paragraph("Skills", H),
        Paragraph("Skills: Python, REST APIs, SQL, pytest, Docker", B),
        Paragraph("Projects", H),
        Paragraph(f"Student API - {link}", B),
        Paragraph("Built REST endpoints with FastAPI for managing users.", B),
        Paragraph("Wrote SQL queries to store and read user data.", B),
        Paragraph("Added unit tests with pytest.", B),
        Paragraph("Containerized the service with Docker for deployment.", B),
        Paragraph("Education", H),
        Paragraph("B.Tech Computer Science, Example University (expected 2027)", B),
    ]
    SimpleDocTemplate(path, pagesize=A4).build(story)

build("resume_a.pdf", "visible")
build("resume_b.pdf", "hyperlink")
# C: rasterize A, wrap in an image-only PDF
with tempfile.TemporaryDirectory() as t:
    subprocess.run(["pdftoppm", "-r", "110", "-png", "-singlefile", "resume_a.pdf", os.path.join(t, "p")], check=True)
    Image.open(os.path.join(t, "p.png")).convert("RGB").save("resume_c_scanned.pdf", "PDF", resolution=110)
print("done for", user)
