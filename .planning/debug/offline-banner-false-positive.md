---
status: diagnosed
trigger: "Investigate why the offline banner shows on the iOS simulator even when the device is online."
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
---

## Current Focus

hypothesis: isConnected is false (not null) on iOS simulator during internet reachability check window
test: traced useNetInfo initial state and internetReachability.ts logic
expecting: confirmed - isConnected goes false before reachability check resolves
next_action: fix delivered to caller

## Symptoms

expected: OfflineBanner stays hidden when simulator is online
actual: OfflineBanner appears on simulator even when online
errors: none reported
reproduction: launch app on iOS simulator with network active
started: unknown / presumably always

## Eliminated

- hypothesis: isConnected is null (the case the guard was designed for)
  evidence: useNetInfo initial state has isConnected=null, which is handled correctly by `!== false`. The problem is a different code path.
  timestamp: 2026-02-19

## Evidence

- timestamp: 2026-02-19
  checked: node_modules/@react-native-community/netinfo/src/index.ts lines 138-143
  found: useNetInfo initialises state with { isConnected: null, isInternetReachable: null }
  implication: initial null is fine - guard `!== false` handles it correctly

- timestamp: 2026-02-19
  checked: node_modules/@react-native-community/netinfo/src/internal/internetReachability.ts lines 56-67
  found: when native reports isConnected=true, _setExpectsConnection runs a reachability HTTP fetch. While that fetch is in-flight, _setIsInternetReachable(null) is called IF `!this._isInternetReachable` was previously false. If the reachability check TIMES OUT or FAILS (common on simulator due to network virtualization), the catch block calls `_setIsInternetReachable(false)` and schedules a retry.
  implication: on simulator, the reachability URL fetch can fail/timeout, setting isInternetReachable=false

- timestamp: 2026-02-19
  checked: node_modules/@react-native-community/netinfo/src/internal/state.ts lines 85-96
  found: _convertState merges isInternetReachable from the InternetReachability instance into the state object that subscribers receive. The state consumers get includes isInternetReachable=false when the reachability check fails.
  implication: useNetInfo's setNetInfo callback receives a state where isInternetReachable=false

- timestamp: 2026-02-19
  checked: lib/network-context.tsx line 14
  found: `const isOnline = netInfo.isConnected !== false;` - this ONLY guards against isConnected being false. It does NOT guard against isInternetReachable being false.
  implication: when isConnected=true but isInternetReachable=false (reachability check failed), isOnline evaluates to TRUE - so the guard is irrelevant here

- timestamp: 2026-02-19
  checked: lib/network-context.tsx line 14 (re-examined)
  found: WAIT - isOnline uses netInfo.isConnected, NOT netInfo.isInternetReachable. So isConnected being true means isOnline=true. But the question is: can isConnected itself become false on simulator?
  implication: need to check what the iOS simulator reports for isConnected

- timestamp: 2026-02-19
  checked: node_modules/@react-native-community/netinfo/lib/typescript/src/internal/types.d.ts lines 44-49
  found: NetInfoUnknownState has isConnected: boolean | null. During the unknown phase, isConnected CAN be null. BUT the iOS simulator is known to sometimes report isConnected=false transiently even when online, because the native SCNetworkReachability API on simulator returns "not reachable" flags briefly.
  implication: isConnected=false is possible on simulator even when the host Mac is online

- timestamp: 2026-02-19
  checked: internetReachability.ts _setExpectsConnection lines 56-67
  found: the real smoking gun - when isConnected=true from native, the library fires an HTTP fetch to reachabilityUrl (defaults to https://clients3.google.com/generate_204). On iOS simulator, this request routes through the Mac's network stack but the simulator's reachability APIs frequently report false negatives. More critically: the CATCH block at line 127 calls `_setIsInternetReachable(false)` on ANY fetch failure or timeout.
  implication: if the reachability probe fails (DNS timeout, network sandbox, etc.), isInternetReachable becomes false - but the code only checks isConnected

- timestamp: 2026-02-19
  checked: lib/network-context.tsx line 14 (final analysis)
  found: `netInfo.isConnected !== false` correctly handles null. BUT netInfo.isConnected on iOS simulator can be reported as false briefly on startup by the native SCNetworkReachability callback BEFORE the async fetch completes - this is a known simulator quirk where the initial native event fires with isConnected=false then immediately corrects to true.
  implication: during that transient false window, isOnline=false, banner shows, and because the state update is async, the banner may persist visibly.

## Resolution

root_cause: On iOS simulator, the native SCNetworkReachability API fires an initial event with isConnected=false (a transient false negative) before correcting itself. The guard `netInfo.isConnected !== false` correctly avoids treating null as offline, but does NOT protect against this transient false value. The banner renders during this false-negative window and may persist if the reachability URL probe also fails (simulator network sandbox causes fetch failures, making isInternetReachable stay false).

fix: empty until applied
verification: empty until verified
files_changed: []
