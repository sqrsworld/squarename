# Security

Squarenames is a pure computation: it takes a coordinate and returns a name,
or a name and returns a coordinate. It makes no network requests, reads no
files, and stores nothing. The most likely security-relevant defect is a
decoding error that returns a wrong location for a valid-looking name.

To report a vulnerability or a defect of that kind, email
**hello@sqrs.world** rather than opening a public issue. Include the input,
the output you got, and the output you expected. You will get a reply within
five working days.

Only the latest published version of the package is supported.
