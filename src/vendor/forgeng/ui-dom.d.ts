/**
 * Minimalni tipovi DomUiShell-a za templejt (bez punog contracts paketa).
 */
export interface UiDisposable {
  dispose(): void | Promise<void>;
}

export interface UiShellLike {
  commands: {
    register(command: {
      id: string;
      title: string;
      execute: (payload?: unknown) => unknown | Promise<unknown>;
    }): UiDisposable;
  };
  notifications: {
    publish(notification: {
      level: "info" | "success" | "warning" | "error";
      title: string;
      message?: string;
      durationMs?: number;
    }): UiDisposable;
  };
  settings: {
    register(schema: {
      id: string;
      title: string;
      fields: readonly {
        id: string;
        label: string;
        kind: "boolean" | "number" | "text" | "select" | "command" | "status";
        commandId?: string;
        read?: () => string | number | boolean | null;
        write?: (value: string | number | boolean | null) => void | Promise<void>;
      }[];
    }): UiDisposable;
    refresh(schemaId?: string): void;
  };
  contributions: {
    register(contribution: {
      id: string;
      title: string;
      slot: "top-bar" | "side-panel" | "bottom-status" | "floating-overlay";
      order?: number;
      settingsSchemaId?: string;
    }): UiDisposable;
  };
  preferences: {
    update(patch: {
      layout?: {
        sidePanelWidth?: number;
        sidePanelCollapsed?: boolean;
        hiddenSlots?: readonly ("top-bar" | "side-panel" | "bottom-status" | "floating-overlay")[];
      };
    }): unknown;
  };
  surfaces?: {
    get(surfaceId: string): { hide(): void } | null;
    subscribe(listener: () => void): UiDisposable;
  };
}

export declare const DOM_UI_SHELL_PROVIDER_DESCRIPTOR: {
  readonly id: string;
  readonly contractVersion: string;
  readonly implementationVersion: string;
  create(options?: unknown): UiShellLike;
};

export declare function createDomUiShellProviderDescriptor(
  options?: unknown,
): typeof DOM_UI_SHELL_PROVIDER_DESCRIPTOR;
