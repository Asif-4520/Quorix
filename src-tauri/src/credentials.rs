use keyring::Entry;

const SERVICE_NAME: &str = "quorix";

pub fn store_password(connection_id: &str, password: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, connection_id).map_err(|e| e.to_string())?;
    entry.set_password(password).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_password(connection_id: &str) -> Result<Option<String>, String> {
    let entry = match Entry::new(SERVICE_NAME, connection_id) {
        Ok(entry) => entry,
        Err(e) => return Err(e.to_string()),
    };
    match entry.get_password() {
        Ok(pwd) => Ok(Some(pwd)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_password(connection_id: &str) -> Result<(), String> {
    let entry = match Entry::new(SERVICE_NAME, connection_id) {
        Ok(entry) => entry,
        Err(e) => return Err(e.to_string()),
    };
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn scrub_secrets(input: &str) -> String {
    let mut output = input.to_string();
    for scheme in ["postgresql://", "postgres://", "mysql://"] {
        let mut search_from = 0;
        while let Some(rel_idx) = output[search_from..].find(scheme) {
            let start = search_from + rel_idx + scheme.len();
            let rest = &output[start..];
            let end_of_auth = rest
                .find(['/', '?', ' ', '\n', '\r', '\t'])
                .unwrap_or(rest.len());
            let authority = &rest[..end_of_auth];
            if let Some(at_pos) = authority.rfind('@') {
                let userinfo = &authority[..at_pos];
                if let Some(colon_pos) = userinfo.find(':') {
                    let redacted_start = start + colon_pos + 1;
                    let redacted_end = start + at_pos;
                    output.replace_range(redacted_start..redacted_end, "***");
                    search_from = start + colon_pos + 4;
                    continue;
                }
            }
            search_from = start;
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::scrub_secrets;

    #[test]
    fn scrubs_passwords_from_postgres_urls() {
        let msg = "failed connecting to postgresql://alice:s3cr3t!@db.example.com:5432/prod";
        assert_eq!(
            scrub_secrets(msg),
            "failed connecting to postgresql://alice:***@db.example.com:5432/prod"
        );
    }

    #[test]
    fn leaves_url_without_password_untouched() {
        let msg = "postgres://alice@localhost:5432/app";
        assert_eq!(scrub_secrets(msg), msg);
    }

    #[test]
    fn scrubs_passwords_from_mysql_urls() {
        let msg = "error connecting to mysql://root:topsecret!@db.local:3306/orders";
        assert_eq!(
            scrub_secrets(msg),
            "error connecting to mysql://root:***@db.local:3306/orders"
        );
    }
}
