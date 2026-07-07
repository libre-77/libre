**English** · [한국어](threat-model.ko.md)

# Threat model

libre defends **lawful speech against censorship**. It is not an anonymity tool by
itself and does not defeat a global passive adversary. Know its limits.

## Adversary

A state or ISP-level actor that can, within its jurisdiction:

- compel a company/operator to take content down or hand over data,
- seize servers and domains, order DNS/SNI/IP blocks,
- pressure app stores to delist,
- demand real-name/phone identification,
- observe network traffic and identify IP addresses.

## Design responses

| Adversary capability | libre response |
| --- | --- |
| Seize/command a central server | There is none. Content lives on independent Nostr relays; the client is static files. |
| Domain/DNS/SNI block | No dependency on one domain. Client mirrored across domains + IPFS + `.onion`; relays are a user-editable multi-endpoint list. |
| App-store delisting | Distribute as a PWA + direct APK + F-Droid, not only via stores. |
| Real-name / phone mandate | No accounts. Identity is a cryptographic key; no phone, no email, no verification. |
| Takedown order | No central party can comply. Moderation is per-community (NIP-72) and per-client, not global. |
| Traffic analysis / IP identity | libre works over Tor/VPN; users who need network anonymity must use them (see below). |

## What libre does NOT protect against

- **Network-level identification.** A relay sees the connecting IP. If you need to
  hide *that you use libre* or *where you post from*, connect via Tor or a trusted
  VPN. libre does not route traffic for you.
- **Key compromise.** Anyone with your private key is you. A NIP-07 extension or
  hardware signer is safer than the local-key fallback.
- **Content-level deanonymization.** Writing style, timing, and self-revealed
  details can identify you regardless of the protocol.
- **Legal liability for what you post.** Censorship resistance is not immunity.
  Defamation and illegal content remain illegal wherever you are.
- **A relay that logs.** Relays can retain data. Assume anything you publish is
  public and permanent.

## Operator note

Running the client or a relay from within the censoring jurisdiction exposes the
operator personally, even when infrastructure sits abroad. Prefer out-of-jurisdiction
hosting and consider anonymous operation and payment. Get local legal advice.
