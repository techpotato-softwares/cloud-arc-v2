from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from io import BytesIO


@dataclass
class Chunk:
    id: str
    tenant_id: str
    corpus_id: str
    document_id: str
    text: str
    embedding: list[float] = field(default_factory=list)

    def citation(self) -> dict:
        return {
            "documentId": self.document_id,
            "chunkId": self.id,
            "excerpt": self.text[:240],
        }


def cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def chunk_text(text: str, size: int = 800) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if not paragraphs:
        paragraphs = [text.strip()] if text.strip() else []
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if current and len(current) + len(paragraph) + 1 > size:
            chunks.append(current)
            current = paragraph
        else:
            current = f"{current}\n{paragraph}".strip()
    if current:
        chunks.append(current)
    return chunks


def load_document(filename: str, content: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if name.endswith(".docx"):
        from docx import Document

        document = Document(BytesIO(content))
        return "\n".join(paragraph.text for paragraph in document.paragraphs).strip()
    if name.endswith(".html") or name.endswith(".htm"):
        text = content.decode("utf-8", errors="replace")
        text = re.sub(r"(?is)<script.*?>.*?</script>|<style.*?>.*?</style>", " ", text)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()
    return content.decode("utf-8", errors="replace").strip()


def postgres_search_sql() -> str:
    return """
        SELECT id, document_id, corpus_id, tenant_id, text,
               1 - (embedding_vec <=> CAST(:embedding AS vector)) AS score
        FROM chunks
        WHERE tenant_id = :tenant_id
        ORDER BY embedding_vec <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """
