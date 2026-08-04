import { createPublicKey, X509Certificate } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const fixtures = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/saml",
);

const expectedCertificates = [
  {
    name: "idp",
    subject: "CN=customreport-test-idp\nO=CustomReport\nC=US",
    fingerprint:
      "3D:A8:F2:26:07:0E:44:2E:0E:1A:45:80:CF:70:F5:68:DB:07:35:D0:64:8A:89:03:A9:82:9E:8D:AD:C4:4F:7C",
  },
  {
    name: "sp",
    subject: "CN=customreport-test-sp\nO=CustomReport\nC=US",
    fingerprint:
      "E8:DF:77:34:75:27:2D:4E:8C:4D:79:9E:53:43:C6:37:31:75:58:A0:66:95:D7:CF:4F:B9:1B:0B:7D:A6:31:B6",
  },
] as const;

function readFixture(name: string, kind: "cert" | "key") {
  return readFileSync(resolve(fixtures, `${name}-${kind}.pem`), "utf8");
}

function certificateBody(value: string) {
  return value.replaceAll(/-----[^-]+-----|\s/g, "");
}

describe("SAML test fixture isolation", () => {
  it("contains only the four named test key and certificate files", () => {
    expect(readdirSync(fixtures).sort()).toEqual([
      "idp-cert.pem",
      "idp-key.pem",
      "sp-cert.pem",
      "sp-key.pem",
    ]);
  });

  it.each(expectedCertificates)(
    "pins the $name certificate identity and matching private key",
    ({ name, subject, fingerprint }) => {
      const certificate = new X509Certificate(readFixture(name, "cert"));
      const publicKey = createPublicKey(readFixture(name, "key"));

      expect(certificate.subject).toBe(subject);
      expect(certificate.fingerprint256).toBe(fingerprint);
      expect(publicKey.export({ type: "spki", format: "der" })).toEqual(
        certificate.publicKey.export({ type: "spki", format: "der" }),
      );
    },
  );

  it("never reuses the configured production IdP certificate", () => {
    const configuredCertificate = process.env.KEYCLOAK_SAML_CERT;
    const configuredBody = configuredCertificate
      ? certificateBody(configuredCertificate)
      : null;

    expect(configuredBody).not.toBe(
      certificateBody(readFixture("idp", "cert")),
    );
  });
});
