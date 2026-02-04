import kittentts
import inspect

try:
    print("Instantiating KittenTTS...")
    model = kittentts.KittenTTS()
    print("Instance members:")
    for member in dir(model):
        if not member.startswith("__"):
            print(member)
except Exception as e:
    print(f"Error instantiating: {e}")
