const UNITS: [&str; 10] = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
];

const TEENS: [&str; 10] = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
];

const TENS: [&str; 10] = [
    "", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

const THOUSANDS_GROUPS: [&str; 4] = ["", " Thousand", " Million", " Billion"];

fn convert_hundreds(mut number: u64) -> String {
    let mut words = String::new();

    if number >= 100 {
        words.push_str(UNITS[(number / 100) as usize]);
        words.push_str(" Hundred ");
        number %= 100;
    }

    if (10..=19).contains(&number) {
        words.push_str(TEENS[(number - 10) as usize]);
        words.push(' ');
        number = 0;
    }

    if number >= 20 {
        words.push_str(TENS[(number / 10) as usize]);
        words.push(' ');
        number %= 10;
    }

    if (1..=9).contains(&number) {
        words.push_str(UNITS[number as usize]);
        words.push(' ');
    }

    words
}

fn convert_to_words(mut number: u64) -> String {
    if number == 0 {
        return "Zero".to_string();
    }

    let mut words = String::new();
    let mut i = 0;

    while number > 0 && i < THOUSANDS_GROUPS.len() {
        if number % 1000 != 0 {
            words = format!(
                "{}{} {}",
                convert_hundreds(number % 1000),
                THOUSANDS_GROUPS[i],
                words
            );
        }
        number /= 1000;
        i += 1;
    }

    words.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Exact port of AccessToDatabase_DRC.AmountToWordsConverter.Convert(double amount)
pub fn amount_to_words_php(amount: f64) -> String {
    if amount == 0.0 {
        return "Zero Pesos Only".to_string();
    }
    if amount < 0.0 {
        return "Negative amount, cannot convert to words".to_string();
    }

    let pesos = amount.floor() as u64;
    let centavos = ((amount - (pesos as f64)) * 100.0).round() as u64;

    let (pesos, centavos) = if centavos >= 100 {
        (pesos + 1, centavos - 100)
    } else {
        (pesos, centavos)
    };

    let peso_words = convert_to_words(pesos);
    if centavos > 0 {
        let centavo_words = convert_to_words(centavos);
        format!("{} Pesos and {} Centavos Only", peso_words, centavo_words)
    } else {
        format!("{} Pesos Only", peso_words)
    }
}
