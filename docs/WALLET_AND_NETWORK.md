# Wallet and network

PriceGuard uses injected EIP-1193 browser wallets on GenLayer Bradbury Testnet. Wallet behavior is deliberately explicit: the user selects a detected provider, approves account access, switches networks when needed, and approves each write.

## Supported wallet transport

Only injected wallets are supported. The repository does not include WalletConnect, QR pairing, hosted keys, private-key import, or server-side signing. A wallet must expose an EIP-1193 `request` method.

## EIP-6963 discovery and provider selection

On startup, the frontend listens for `eip6963:announceProvider` and dispatches `eip6963:requestProvider`. It accepts announcements with a nonempty UUID and name plus a provider implementing `request`. Icons are accepted only as bounded base64 image data; reverse-domain metadata is length-bounded.

Providers are keyed by EIP-6963 UUID and duplicate provider objects are de-duplicated. Once an EIP-6963 provider is received, the legacy `window.ethereum` fallback is removed. The user's selected UUID is resolved to the exact provider object for `eth_requestAccounts`; the selection remains stable while that provider is still announced. The application never relies on the nonstandard `window.ethereum.providers` array.

## App-session disconnect

“Disconnect from PriceGuard” clears the wallet, chain, and Activity view for the current application session and stores a local manual-disconnect flag. That flag blocks automatic `eth_accounts` hydration and account-change handling until the user explicitly connects again.

This does not revoke the site's authorization in the wallet extension. Revocation, if desired, must be performed using the wallet's own connected-sites or permissions interface. PriceGuard does not call wallet permission-revocation methods.

## Bradbury metadata

| Field | Value |
| --- | --- |
| Network | GenLayer Bradbury Testnet |
| Chain ID | `4221` |
| Hex chain ID | `0x107d` |
| Native currency | `GEN` |
| Native decimals | `18` |
| RPC URL | `https://rpc-bradbury.genlayer.com` |
| Explorer | `https://explorer-bradbury.genlayer.com` |

## Explicit switch and add flow

The network action uses the selected provider directly:

1. Ensure a connected account is available.
2. Call `wallet_switchEthereumChain` with `0x107d`.
3. If and only if that call fails with error code `4902`, call `wallet_addEthereumChain` using the metadata above.
4. Call `wallet_switchEthereumChain` again.
5. Read `eth_chainId` and require chain `4221`.

Other errors do not trigger an add request. A user rejection, an already-pending wallet request, an unsupported method, or a post-switch network mismatch is surfaced without submitting a contract write.

## Rabby-compatible writes

The write client is constructed with the selected provider and account. The frontend then calls `writeContract` with `value: 0n`. This keeps normal writes within the injected provider selected by the user and is compatible with Rabby's EIP-1193 flow.

PriceGuard does not call GenLayerJS `client.connect()` for normal writes. During wallet compatibility diagnosis, that connection path led MetaMask to receive `wallet_getSnaps`, which was unsupported in the affected environment. The current path does not invoke `wallet_getSnaps`, `wallet_requestSnaps`, `wallet_invokeSnap`, or other Snap RPC methods.

This is a wallet-transport compatibility decision; it does not change the contract method, arguments, value, submission semantics, or finality classification.

## Pre-write re-verification

Immediately before every `writeContract` call, PriceGuard requests:

- `eth_chainId`, which must resolve to Bradbury chain `4221`; and
- `eth_accounts`, whose first account must match the account connected to the PriceGuard session, case-insensitively.

If the chain or account changed, submission stops before the wallet write request. The user must switch explicitly or reconnect the PriceGuard session.

## Safe wallet and RPC errors

The frontend extracts only bounded, known-safe message fields and a simple error code from unknown thrown values. It does not serialize the entire provider error or raw request payload. Stack frames, bearer tokens, private keys, seed phrases, signatures, and long hexadecimal payloads are removed or redacted before display.

Common handled cases include:

- `4001`: the user declined connection or network switching;
- `-32002`: another wallet request is already open;
- `-32601`: automatic network switching is unsupported;
- `4902`: Bradbury is unknown to the wallet, so the explicit add flow is permitted;
- network mismatch after switching;
- no account returned, provider no longer available, changed account, malformed contract state, invalid transaction hash, and temporary transaction-polling failure.

Provider-specific messages are not assumed to be trustworthy or safe for unrestricted rendering.

## Wrong-network recovery

Open the connected account menu and choose “Switch to Bradbury.” Complete any pending request in the selected wallet. If automatic switching is unsupported, add or select Bradbury manually using the exact metadata above, return to PriceGuard, and retry the action. If the active account changed, reconnect PriceGuard before submitting.

Never change RPC or chain metadata based on an untrusted prompt or unsolicited message.

## No automatic resubmission

PriceGuard blocks a duplicate action while its prior transaction is unfinished and never resubmits automatically after an unknown error, delayed receipt, cancellation, or execution failure. First inspect Activity and the Bradbury explorer. A retry is always an explicit user decision because a delayed transaction may still finalize.
