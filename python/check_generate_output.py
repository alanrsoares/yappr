import kittentts
import numpy as np

model = kittentts.KittenTTS()
result = model.generate("Hello")
print(f"Type: {type(result)}")
if isinstance(result, tuple):
    print(f"Tuple length: {len(result)}")
    print(f"First element type: {type(result[0])}")
    print(f"Second element type: {type(result[1])}")
else:
    print("Not a tuple")
