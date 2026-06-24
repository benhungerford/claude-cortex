# Bundled embedding model weights

Cortex's semantic search runs the **`all-MiniLM-L6-v2`** sentence-embedding
model fully **offline** via `@huggingface/transformers` (ONNX runtime). To keep
the "no data leaves your machine" promise, the model is loaded from this
directory — `env.allowRemoteModels` is set to `false` in
[`../lib/embeddings.js`](../lib/embeddings.js), so **no network call is ever
made** to huggingface.co at runtime.

## What goes here

The directory layout below mirrors the Hugging Face Hub repo
[`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
exactly. `@huggingface/transformers` resolves `localModelPath/<repo>/...`:

```
models/
└── Xenova/
    └── all-MiniLM-L6-v2/
        ├── config.json              (~650 B,  committed)
        ├── tokenizer.json           (~700 KB, committed)
        ├── tokenizer_config.json    (~370 B,  committed)
        └── onnx/
            └── model.onnx           (~86 MB,  NOT committed — see below)
```

The small JSON files are committed to git. **The ~86 MB `onnx/model.onnx`
weight file is intentionally git-ignored** (see `.gitignore` in this
directory) — it is too large to commit. It must be present on disk at runtime.

## How to populate `onnx/model.onnx`

Pick one:

1. **Bundle at package/install time (recommended for distribution).** Ship the
   weight in the plugin tarball, or copy it from the `@huggingface/transformers`
   on-disk cache after one online run:

   ```sh
   cp node_modules/@huggingface/transformers/.cache/Xenova/all-MiniLM-L6-v2/onnx/model.onnx \
      models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx
   ```

2. **Download once, explicitly, with consent:**

   ```sh
   curl -L -o models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx \
     https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx
   ```

## What happens if the weights are missing

`embeddings.js` checks for the weight file before loading the pipeline. If it is
absent, semantic search (`search_vault` / `recall_related`) fails fast with a
clear, actionable error telling you exactly which file is missing and how to
obtain it — **it never silently hits the network.**
