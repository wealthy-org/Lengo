"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_NETWORK,
  DEPLOYMENTS,
  getNetworkMode,
  setNetworkMode,
  subscribeNetworkMode,
  type NetworkDeployment,
  type NetworkMode,
} from "./chain";

export function useNetwork(): NetworkDeployment & { setMode: (m: NetworkMode) => void } {
  const mode = useSyncExternalStore(subscribeNetworkMode, getNetworkMode, () => DEFAULT_NETWORK);
  return { ...DEPLOYMENTS[mode], setMode: setNetworkMode };
}
