import kittentts
import inspect

print("KittenTTS members:")
print(dir(kittentts))

# Try to find the main class or function
if hasattr(kittentts, 'KittenTTS'):
    print("\nKittenTTS class found.")
    print(inspect.signature(kittentts.KittenTTS))
elif hasattr(kittentts, 'tts'):
    print("\ntts function found.")
    print(inspect.signature(kittentts.tts))
else:
    print("\nCould not find obvious entry point.")

