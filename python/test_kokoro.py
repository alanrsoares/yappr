import kokoro
import soundfile as sf

# Initialize pipeline
pipeline = kokoro.KPipeline(lang_code='a') # 'a' for American English

# Generate audio
# pipeline returns a generator of (graphemes, phonemes, audio)
generator = pipeline('Hello, this is a test of Kokoro TTS.', voice='af_bella', speed=1)

print("Generating...")
for i, (gs, ps, audio) in enumerate(generator):
    print(f"Segment {i}: {gs}")
    sf.write(f'kokoro_test_{i}.wav', audio, 24000)
print("Done.")
