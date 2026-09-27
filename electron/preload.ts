import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("gateHelper", Object.freeze({ shell: "electron" }));

