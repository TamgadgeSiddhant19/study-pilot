from dataclasses import dataclass
from typing import List, Tuple, Optional
from app.core.config import settings


@dataclass
class TextChunk:
    chunk_index: int
    text: str
    page_number: Optional[int]
    token_count: int


class ParagraphChunker:
    """
    Splits extracted document text into overlapping, meaningful passages.
    Favors natural paragraph and sentence boundaries over arbitrary character splits.
    """

    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ):
        self.chunk_size = chunk_size or settings.RAG_CHUNK_SIZE or 1000
        self.chunk_overlap = chunk_overlap or settings.RAG_CHUNK_OVERLAP or 200
        if self.chunk_overlap >= self.chunk_size:
            self.chunk_overlap = self.chunk_size // 4

    def chunk_pages(self, pages: List[Tuple[int, str]]) -> List[TextChunk]:
        """
        Takes a list of (page_number, text) tuples and produces chunk objects
        retaining source page attribution.
        """
        all_chunks: List[TextChunk] = []
        global_index = 0

        for page_num, page_text in pages:
            if not page_text.strip():
                continue

            page_chunks = self._chunk_single_text(page_text)
            for chunk_str in page_chunks:
                # Estimate tokens (~4 characters per token in standard technical English)
                token_est = max(1, len(chunk_str) // 4)
                all_chunks.append(
                    TextChunk(
                        chunk_index=global_index,
                        text=chunk_str,
                        page_number=page_num,
                        token_count=token_est,
                    )
                )
                global_index += 1

        return all_chunks

    def _chunk_single_text(self, text: str) -> List[str]:
        """Splits a single block of text using paragraph and sentence boundaries with overlap."""
        if len(text) <= self.chunk_size:
            return [text.strip()]

        # Split into paragraphs
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks: List[str] = []
        current_chunk = ""

        for para in paragraphs:
            # If paragraph itself is too large, break it into sentences
            if len(para) > self.chunk_size:
                sub_sentences = self._split_sentences(para)
                for sentence in sub_sentences:
                    if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                            overlap_prefix = current_chunk[-self.chunk_overlap:] if self.chunk_overlap > 0 else ""
                            current_chunk = f"{overlap_prefix} {sentence}".strip()
                        else:
                            # Hard split if individual sentence exceeds chunk_size
                            chunks.append(sentence[:self.chunk_size])
                            current_chunk = sentence[self.chunk_size - self.chunk_overlap:]
            else:
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    current_chunk = f"{current_chunk}\n\n{para}".strip()
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                        # Carry over overlap
                        overlap_prefix = current_chunk[-self.chunk_overlap:] if self.chunk_overlap > 0 else ""
                        current_chunk = f"{overlap_prefix}\n\n{para}".strip()
                    else:
                        current_chunk = para

        if current_chunk and current_chunk not in chunks:
            chunks.append(current_chunk)

        return [c for c in chunks if len(c.strip()) >= 20]

    def _split_sentences(self, paragraph: str) -> List[str]:
        """Splits a paragraph into sentence chunks."""
        import re
        # Split on punctuation followed by whitespace
        parts = re.split(r"(?<=[.?!])\s+", paragraph)
        return [p.strip() for p in parts if p.strip()]
