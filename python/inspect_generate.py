import kittentts
import inspect

model = kittentts.KittenTTS()
print("\nSignature of generate:")
print(inspect.signature(model.generate))
