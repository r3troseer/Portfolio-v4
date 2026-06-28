---
title: Applied AI / NLP
type: role-lens
roleLens: ai-nlp
visibility: public
sensitivity: safe
---

# Applied AI / NLP

I build applications around AI and NLP rather than calling a model and hoping for the best. I
focus on what happens around the model: how text is chunked, how output is parsed and
validated, how the system fails safely, and how a human reviews the result.

Evidence from public projects:
- **MealSync**: Google Gemini for recipe and meal-plan generation, with a three-tier JSON
  extraction strategy and graceful degradation when the service is unavailable; AI calls are
  mocked in tests for 93% coverage.
- **GFA Exchange**: a multi-agent pipeline with LLM-generated, plain-English explanations
  backed by deterministic template fallbacks, so explanations never depend on a black box.
- **PACTGuard**: compares deterministic rules, semantic retrieval (sentence-transformers
  with cosine similarity), and a Gemini judge, with evidence-bound explanations.
- **StudyBud**: document intelligence over PDF and DOCX (text extraction, chunking,
  summaries, and quiz generation).

I also work on applied NLP and document-intelligence research (ESG and sustainability claim
analysis), where evidence-grounding and human-in-the-loop review matter most.
