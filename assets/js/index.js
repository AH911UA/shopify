const phone = document.getElementById('intl-phone');
const form = document.getElementById('payment-form');
const inputs = form.querySelectorAll('input');
const selects = form.querySelectorAll('select');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const continueBtn = document.getElementById('continue-btn');

const stepIndicator1 = document.getElementById('step-indicator-1');
const stepIndicator2 = document.getElementById('step-indicator-2');
const stepConnector = document.querySelector('.step-connector');

step1.classList.add('active');
step2.classList.remove('active');

const iti = window.intlTelInput(phone, {
    autoPlaceholder: "polite",
    initialCountry: "ua",
    preferredCountries: [],
    separateDialCode: false,
    nationalMode: false,
    utilsScript: "/assets/js/intlTelInput.utils.min.js",
});

// Make intlTelInput instance globally accessible
window.iti = iti;

new Swiper(".mySwiper", {
    navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
    },
    pagination: {
        el: ".swiper-pagination",
    },
});

continueBtn.addEventListener('click', function() {
    if (validateStep1()) {
        step1.classList.remove('active');
        step2.classList.add('active');
        stepIndicator1.classList.remove('active');
        stepIndicator1.classList.add('completed');
        stepIndicator2.classList.add('active');
        stepConnector.classList.add('completed');
    }
});

const touchedInputs = new WeakMap();

function markTouched(input) {
    touchedInputs.set(input, true);
}

function isTouched(input) {
    return touchedInputs.get(input);
}

function validateStep1() {
    const step1Inputs = step1.querySelectorAll('input[required], select[required]');
    let isValid = true;

    step1Inputs.forEach(input => {
        if (input.type === "tel") {
            if (!iti.isValidNumber()) {
                input.classList.add('is-invalid');
                input.classList.remove('is-valid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
                input.classList.add('is-valid');
            }
        } else {
            if (!validate(input)) {
                isValid = false;
            }
        }
    });

    return isValid;
}

function setStep1ButtonState() {
    const step1Inputs = step1.querySelectorAll('input[required], select[required]');
    let allValid = true;
    step1Inputs.forEach(input => {
        if (input.type === "tel") {
            if (!iti.isValidNumber()) allValid = false;
        } else {
            if (!validate(input)) allValid = false;
        }
    });
    continueBtn.disabled = !allValid;
}

function setStep2ButtonState() {
    const step2Inputs = step2.querySelectorAll('input[required], select[required]');
    let allValid = true;
    step2Inputs.forEach(input => {
        if (!validate(input)) allValid = false;
    });
    const payBtn = document.getElementById('card-btn-submit');
    if (payBtn) payBtn.disabled = !allValid;
}

inputs.forEach((input) => {
    input.addEventListener('input', (e) => {
        markTouched(e.target);
        validate(e.target);
        setStep1ButtonState();
        setStep2ButtonState();
    });
    input.addEventListener('blur', (e) => {
        markTouched(e.target);
        validate(e.target);
        setStep1ButtonState();
        setStep2ButtonState();
    });
    input.addEventListener('change', (e) => {
        markTouched(e.target);
        validate(e.target);
        setStep1ButtonState();
        setStep2ButtonState();
    });
});
selects.forEach((select) => {
    select.addEventListener('change', (e) => {
        markTouched(e.target);
        validate(e.target);
        setStep1ButtonState();
        setStep2ButtonState();
    });
    select.addEventListener('blur', (e) => {
        markTouched(e.target);
        validate(e.target);
        setStep1ButtonState();
        setStep2ButtonState();
    });
});

setStep1ButtonState();
setStep2ButtonState();

function luhnCheck(cardNumber) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i));
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

const countrySelect = form.querySelector('select[name="countryCode"]');

function validatePhoneLib(phoneInput, countrySelect) {
    const value = phoneInput.value.trim();
    const country = countrySelect.value;
    let phoneNumber;

    if (!value) return false;

    const parseFn = window.libphonenumber
        ? window.libphonenumber.parsePhoneNumberFromString
        : window.parsePhoneNumberFromString;

    if (typeof parseFn !== 'function') {
        console.error('parsePhoneNumberFromString is not available!');
        phoneInput.classList.add('is-invalid');
        phoneInput.classList.remove('is-valid');
        phoneInput.setCustomValidity('Phone validation library not loaded');
        return false;
    }

    try {
        if (value.startsWith('+')) {
            phoneNumber = parseFn(value);
        } else {
            phoneNumber = parseFn(value, country);
        }

        const possible = phoneNumber && phoneNumber.isPossible();
        const valid = phoneNumber && phoneNumber.isValid();

        phoneInput.classList.toggle('is-valid', possible && valid);
        phoneInput.classList.toggle('is-invalid', !(possible && valid));

        return possible && valid;
    } catch (e) {
        phoneInput.classList.add('is-invalid');
        phoneInput.classList.remove('is-valid');
        phoneInput.setCustomValidity('Ошибка в номере');
        console.error('libphonenumber-js error:', e);
        return false;
    }
}

phone.addEventListener('input', function() {
    validatePhoneLib(phone, countrySelect);
});
countrySelect.addEventListener('change', function() {
    validatePhoneLib(phone, countrySelect);
});

function validate(input) {
    let isValid = true;
    let value = input.value.trim();
    if (input.name === 'firstName' || input.name === 'lastName') {
        isValid = /^[A-Za-zА-Яа-яЁё\s'-]{2,}$/.test(value);
    } else if (input.name === 'address') {
        isValid = value.length >= 5;
    } else if (input.name === 'postalCode') {
        isValid = /^\d{3,12}$/.test(value);
    } else if (input.name === 'city') {
        isValid = /^[A-Za-zА-Яа-яЁё\s'-]{2,}$/.test(value);
    } else if (input.type === 'email' || input.name === 'email') {
        isValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    } else if (input.type === 'tel' || input.name === 'phone') {
        isValid = validatePhoneLib(input, countrySelect);
    } else if (input.tagName === 'SELECT' || input.name === 'countryCode') {
        isValid = !!value;
    } else if (input.name === 'cardHolder') {
        isValid = /^[A-Za-zА-Яа-яЁё\s'-]{3,}$/.test(value);
    } else if (input.name === 'cardNumber') {
        const digits = value.replace(/\s+/g, '');
        isValid = /^\d{16}$/.test(digits) || (/^\d{13,19}$/.test(digits) && luhnCheck(digits));
    } else if (input.name === 'expiry') {
        isValid = /^\d{2}\/\d{2}$/.test(value);
        if (isValid) {
            const [mm, yy] = value.split('/');
            const month = parseInt(mm, 10);
            const year = 2000 + parseInt(yy, 10);
            const now = new Date();
            const thisMonth = now.getMonth() + 1;
            const thisYear = now.getFullYear();
            isValid = month >= 1 && month <= 12 && (year > thisYear || (year === thisYear && month >= thisMonth));
        }
    } else if (input.name === 'cvv') {
        isValid = /^\d{3,4}$/.test(value);
    } else {
        isValid = input.checkValidity();
    }
    if (isTouched(input)) {
        if (!isValid) {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        } else {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        }
    } else {
        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');
    }

    return isValid;
}

// Expose functions globally for use in other scripts
window.markTouched = markTouched;
window.isTouched = isTouched;
window.validateStep1 = validateStep1;
window.setStep1ButtonState = setStep1ButtonState;
window.setStep2ButtonState = setStep2ButtonState;
window.validatePhoneLib = validatePhoneLib;
window.validate = validate;

const paymentForm = document.getElementById('payment-form');
if (paymentForm) {
    paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.locale = document.getElementById('lang-select').value.toUpperCase();

        const selectedPlanInput = document.querySelector('input[name="plan"]:checked');
        if (selectedPlanInput) {
            data.plan = selectedPlanInput.value;
        }

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                const errorMessage = result.error || 'An unknown error occurred.';
                showErrorModal(errorMessage);
                submitButton.disabled = false;
                submitButton.textContent = 'Pay';
                return;
            }

            const fb = form.querySelector('input[name="fb"]').value;
            const price = "1.00";
            const currency = new URLSearchParams(window.location.search).get('currency');
            window.location.href = `/payment-success?fb=${fb}&price=${price}&currency=${currency}`;

        } catch (err) {
            showErrorModal('A connection error occurred with the server.');
            submitButton.disabled = false;
            submitButton.textContent = 'Pay';
        }
    });
}

function showErrorModal(message) {
    const modalBody = document.getElementById('errorModalBody');
    if (modalBody) {
        if (typeof message === 'string' && message.trim().startsWith('<')) {
            modalBody.innerHTML = message;
        } else {
            modalBody.textContent = message;
        }
    }
    try {
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        errorModal.show();
    } catch (e) {
        console.error('Ошибка показа модального окна:', e, message);
    }
}

(function() {
    const NAMES = [
        'M*****o', 'A****a', 'J****n', 'S****h', 'E****e', 'D****d', 'L****a', 'C****e', 'P****r', 'K****y',
        'T****s', 'R****l', 'B****y', 'N****a', 'F****s', 'V****a', 'I****a', 'O****r', 'G****e', 'Z****a'
    ];
    const PERIOD_MS = 3 * 60 * 1000; // 3 минуты
    const TIMES = [90, 60, 45, 30, 20, 15, 10, 7, 5, 3]; // минуты назад
    let shown = 0;

    function getProductName() {
        const el = document.getElementById('service-name');
        return el ? el.textContent.trim() : '';
    }

    function showTooltip(name, product, minutesAgo) {
        const old = document.getElementById('purchase-tooltip');
        if (old) old.remove();
        const tooltip = document.createElement('div');
        tooltip.id = 'purchase-tooltip';
        tooltip.style.position = 'fixed';
        tooltip.style.right = '20px';
        tooltip.style.bottom = '30px';
        tooltip.style.background = '#b6f7c2';
        tooltip.style.color = '#222';
        tooltip.style.padding = '16px 22px 12px 22px';
        tooltip.style.borderRadius = '12px';
        tooltip.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        tooltip.style.zIndex = 9999;
        tooltip.style.fontSize = '16px';
        tooltip.style.minWidth = '220px';
        tooltip.style.maxWidth = '90vw';
        tooltip.style.transition = 'opacity 0.4s';
        tooltip.style.opacity = '0';
        tooltip.style.display = 'flex';
        tooltip.style.flexDirection = 'column';
        tooltip.style.gap = '6px';

        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '12px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '22px';
        closeBtn.style.color = '#888';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.userSelect = 'none';
        closeBtn.addEventListener('click', () => {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.remove(), 400);
        });
        tooltip.appendChild(closeBtn);

        const main = document.createElement('div');
        main.innerHTML = `<b>${product}</b><br>${name} got this (${minutesAgo} minutes ago)`;
        tooltip.appendChild(main);

        const now = new Date();
        const purchaseDate = new Date(now.getTime() - minutesAgo * 60000);
        const pad = n => n.toString().padStart(2, '0');
        const timeStr = `${pad(purchaseDate.getDate())}/${pad(purchaseDate.getMonth()+1)} - ${pad(purchaseDate.getHours())}:${pad(purchaseDate.getMinutes())}`;
        const timeDiv = document.createElement('div');
        timeDiv.style.fontSize = '13px';
        timeDiv.style.color = '#444';
        timeDiv.style.marginTop = '4px';
        timeDiv.textContent = timeStr;
        tooltip.appendChild(timeDiv);

        document.body.appendChild(tooltip);
        setTimeout(() => { tooltip.style.opacity = '1'; }, 50);
        setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.remove(), 400);
        }, 5000);
    }

    function nextTooltip() {
        const product = getProductName() || 'Product';
        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
        const minutesAgo = TIMES[Math.min(shown, TIMES.length - 1)];
        showTooltip(name, product, minutesAgo);
        shown++;
        setTimeout(nextTooltip, PERIOD_MS);
    }

    window.addEventListener('DOMContentLoaded', function() {
        setTimeout(nextTooltip, 8000);
    });
})();

// Card number formatting
const cardNumberInput = document.querySelector('input[name="cardNumber"]');
if (cardNumberInput) {
  cardNumberInput.addEventListener('input', function(e) {
    let value = e.target.value;

    // Remove all non-digit characters
    value = value.replace(/\D/g, '');

    // Add spaces after every 4 digits
    let formattedValue = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedValue += ' ';
      }
      formattedValue += value[i];
    }

    // Limit to max 16 digits (16 digits + 3 spaces for standard cards)
    if (value.length > 16) {
      value = value.slice(0, 16);
      formattedValue = formattedValue.slice(0, 19); // 16 digits + 3 spaces
    }

    // Update the input value
    e.target.value = formattedValue;

    // Trigger validation
    markTouched(e.target);
    validate(e.target);
    setStep2ButtonState();
  });
}

// Expiry date formatting
const expiryInput = document.getElementById('card-expiry');
if (expiryInput) {
  expiryInput.addEventListener('input', function(e) {
    let value = e.target.value;

    // Remove all non-digit characters
    value = value.replace(/\D/g, '');

    // Add slash after 2 digits
    if (value.length > 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }

    // Limit to 4 digits (MM/YY)
    if (value.length > 5) {
      value = value.slice(0, 5);
    }

    // Update the input value
    e.target.value = value;

    // Validate month input (first 2 digits)
    if (value.length >= 2) {
      const month = parseInt(value.slice(0, 2));
      if (month < 1 || month > 12) {
        e.target.classList.add('is-invalid');
        e.target.classList.remove('is-valid');
      } else {
        markTouched(e.target);
        validate(e.target);
        setStep2ButtonState();
      }
    }
  });
}

// CardHolder name validation - only allow letters, spaces, and hyphens
const cardHolderInput = document.querySelector('input[name="cardHolder"]');
if (cardHolderInput) {
  cardHolderInput.addEventListener('input', function(e) {
    let value = e.target.value;

    // Replace any non-letter characters (except spaces and hyphens)
    const filteredValue = value.replace(/[^A-Za-zА-Яа-яЁё\s'-]/g, '');

    // Update the input value if it was changed
    if (value !== filteredValue) {
      e.target.value = filteredValue;
    }

    markTouched(e.target);
    validate(e.target);
    setStep2ButtonState();
  });
}

// CVV validation - only allow numbers
const cvvInput = document.querySelector('input[name="cvv"]');
if (cvvInput) {
  cvvInput.addEventListener('input', function(e) {
    let value = e.target.value;

    // Replace any non-digit characters
    const filteredValue = value.replace(/\D/g, '');

    // Limit to 3-4 digits
    const limitedValue = filteredValue.slice(0, 4);

    // Update the input value if it was changed
    if (value !== limitedValue) {
      e.target.value = limitedValue;
    }

    markTouched(e.target);
    validate(e.target);
    setStep2ButtonState();
  });
}
