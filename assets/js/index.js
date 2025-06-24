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
        isValid = /^\d{4,12}$/.test(value);
    } else if (input.name === 'city') {
        isValid = /^[A-Za-zА-Яа-яЁё\s'-]{2,}$/.test(value);
    } else if (input.type === 'email' || input.name === 'email') {
        isValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    } else if (input.type === 'tel' || input.name === 'phone') {
        isValid = validatePhoneLib(input, countrySelect);
    } else if (input.tagName === 'SELECT' || input.name === 'countryCode') {
        isValid = !!value;
    } else if (input.name === 'cardNumber') {
        const digits = value.replace(/\s+/g, '');
        isValid = /^\d{13,19}$/.test(digits) && luhnCheck(digits);
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

const paymentForm = document.getElementById('payment-form');
if (paymentForm) {
    paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorText = await response.text();
                showErrorModal(errorText);
                return;
            }
            window.location.href = '/payment-success';
        } catch (err) {
            showErrorModal('Ошибка соединения с сервером');
        }
    });
}

function showErrorModal(message) {
    // const modalBody = document.getElementById('errorModalBody');
    // if (modalBody) {
    //     if (typeof message === 'string' && message.trim().startsWith('<')) {
    //         modalBody.innerHTML = message;
    //     } else {
    //         modalBody.textContent = message;
    //     }
    //     modalBody.style.maxHeight = '60vh';
    //     modalBody.style.overflowY = 'auto';
    // }
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

