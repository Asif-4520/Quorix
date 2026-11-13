use crate::drivers::DatabaseError;

pub fn csv_escape(field: &str) -> String {
    if field.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

pub fn parse_csv_records(input: &str) -> Result<Vec<Vec<String>>, DatabaseError> {
    let mut records = Vec::new();
    let mut current_row = Vec::new();
    let mut current_field = String::new();
    let mut in_quotes = false;
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    chars.next();
                    current_field.push('"');
                } else {
                    in_quotes = false;
                }
            } else {
                current_field.push(c);
            }
        } else {
            match c {
                '"' if current_field.is_empty() => {
                    in_quotes = true;
                }
                ',' => {
                    current_row.push(std::mem::take(&mut current_field));
                }
                '\r' => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    current_row.push(std::mem::take(&mut current_field));
                    records.push(std::mem::take(&mut current_row));
                }
                '\n' => {
                    current_row.push(std::mem::take(&mut current_field));
                    records.push(std::mem::take(&mut current_row));
                }
                other => current_field.push(other),
            }
        }
    }

    if in_quotes {
        return Err(DatabaseError::ImportError(
            "Unterminated quoted CSV field".to_string(),
        ));
    }

    if !current_field.is_empty() || !current_row.is_empty() {
        current_row.push(current_field);
        records.push(current_row);
    }

    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rfc4180_multiline_quoted_csv() {
        let csv = "id,bio\n1,\"Hello,\n\"\"World\"\"!\"\n2,simple";
        let records = parse_csv_records(csv).expect("parse csv");
        assert_eq!(records.len(), 3);
        assert_eq!(records[1][1], "Hello,\n\"World\"!");
        assert_eq!(records[2][1], "simple");
    }
}
