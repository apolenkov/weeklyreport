-- The demo seed gives users a dev-login samlId. SAML uses the e-mail as NameID,
-- and a different samlId for the same e-mail is refused as an identity mismatch.
UPDATE "User" SET "samlId" = email
WHERE email IN ('lead1@customreport.local', 'head@customreport.local',
                'viewer@customreport.local', 'admin@customreport.local');
