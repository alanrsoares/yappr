import React from "react";

const EMPTY: unique symbol = Symbol("unstated-empty");

export interface ContainerProviderProps<State = void> {
  initialState?: State;
  children: React.ReactNode;
}

export interface Container<Value, State = void> {
  Provider: React.ComponentType<ContainerProviderProps<State>>;
  useContainer: () => Value;
}

export function createContainer<Value, State = void>(
  useHook: (initialState?: State) => Value,
): Container<Value, State> {
  const Context = React.createContext<Value | typeof EMPTY>(EMPTY);

  function Provider({ initialState, children }: ContainerProviderProps<State>) {
    const value = useHook(initialState);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useContainer(): Value {
    const value = React.use(Context);
    if (value === EMPTY) {
      throw new Error(
        "useContainer must be used within the corresponding Container.Provider",
      );
    }
    return value as Value;
  }

  return { Provider, useContainer };
}

export function useContainer<Value, State = void>(
  container: Container<Value, State>,
): Value {
  return container.useContainer();
}
