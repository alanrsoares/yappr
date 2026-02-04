import kittentts
import inspect

model = kittentts.KittenTTS()
try:
    print(inspect.getsource(model.generate_to_file))
except Exception as e:
    print(e)
