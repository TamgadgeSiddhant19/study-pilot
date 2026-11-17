import io
import re
from typing import List, Tuple
from pypdf import PdfReader
from pypdf.errors import PdfReadError


class DocumentExtractor:
    """
    Extracts text and page-level metadata from supported documents:
    - PDF (.pdf, application/pdf)
    - Markdown (.md, text/markdown)
    - Plain Text (.txt, text/plain)
    """

    SUPPORTED_EXTENSIONS = {".pdf", ".md", ".txt"}
    SUPPORTED_MIME_TYPES = {
        "application/pdf",
        "text/markdown",
        "text/plain",
        "application/octet-stream",  # Often sent by browsers for .md files
    }

    @classmethod
    def validate_file_type(cls, filename: str, content_type: str, content: bytes) -> str:
        """
        Validates file extension, MIME type, and file signature.
        Returns normalized category: 'pdf', 'markdown', or 'text'.
        """
        lower_name = filename.lower()
        matched_ext = next((ext for ext in cls.SUPPORTED_EXTENSIONS if lower_name.endswith(ext)), None)
        if not matched_ext:
            raise ValueError(
                f"Unsupported file format '{filename}'. Supported formats are: PDF (.pdf), Markdown (.md), and Text (.txt)."
            )

        if matched_ext == ".pdf":
            # Verify PDF magic header
            if not content.startswith(b"%PDF-"):
                raise ValueError("Invalid PDF file: Missing standard %PDF magic header.")
            return "pdf"
        elif matched_ext == ".md":
            return "markdown"
        else:
            return "text"

    @classmethod
    def extract_text(cls, filename: str, content_type: str, content: bytes) -> List[Tuple[int, str]]:
        """
        Extracts text from document bytes.
        Returns list of (page_number, text) tuples.
        """
        doc_type = cls.validate_file_type(filename, content_type, content)

        if doc_type == "pdf":
            return cls._extract_pdf(content)
        else:
            return cls._extract_text_file(content)

    @classmethod
    def _extract_pdf(cls, content: bytes) -> List[Tuple[int, str]]:
        """Extracts text page-by-page from a PDF."""
        try:
            reader = PdfReader(io.BytesIO(content))
        except (PdfReadError, Exception) as e:
            raise ValueError(f"Malformed or corrupt PDF file: {str(e)}")

        if reader.is_encrypted:
            raise ValueError(
                "PDF is encrypted or password-protected. Please upload an unencrypted document."
            )

        num_pages = len(reader.pages)
        if num_pages == 0:
            raise ValueError("PDF document has 0 pages.")

        page_data: List[Tuple[int, str]] = []
        total_text_chars = 0

        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            try:
                page_text = page.extract_text() or ""
            except Exception:
                page_text = ""

            cleaned_text = cls._normalize_text(page_text)
            if cleaned_text:
                page_data.append((page_num, cleaned_text))
                total_text_chars += len(cleaned_text)

        if total_text_chars < 20:
            raise ValueError(
                "PDF contains no extractable text. The file appears to be a scanned or image-only document, which requires OCR to ingest."
            )

        return page_data

    @classmethod
    def _extract_text_file(cls, content: bytes) -> List[Tuple[int, str]]:
        """Extracts plain text or markdown content."""
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = content.decode("latin-1")
            except Exception:
                raise ValueError("File encoding not recognized. Please use UTF-8 text.")

        cleaned = cls._normalize_text(text)
        if not cleaned or len(cleaned.strip()) < 10:
            raise ValueError("Document appears to be empty or contains insufficient text content.")

        return [(1, cleaned)]

    @classmethod
    def _normalize_text(cls, text: str) -> str:
        """Normalizes whitespace while preserving paragraphs and Markdown headings."""
        if not text:
            return ""

        # Normalize line breaks
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Replace excessive whitespace within lines
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]

        # Collapse more than two consecutive empty lines into two (paragraph break)
        normalized_paragraphs: List[str] = []
        consecutive_empty = 0
        for line in lines:
            if not line:
                consecutive_empty += 1
                if consecutive_empty <= 1:
                    normalized_paragraphs.append("")
            else:
                consecutive_empty = 0
                normalized_paragraphs.append(line)

        return "\n".join(normalized_paragraphs).strip()
