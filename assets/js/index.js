const phone = document.getElementById('intl-phone');
const form = document.getElementById('payment-form');
const inputs = form.querySelectorAll('input');

const iti = window.intlTelInput(phone, {
    autoPlaceholder: "off",
    initialCountry: "ua",
    preferredCountries: [],
    separateDialCode: false,
    nationalMode: false,
    utilsScript: "/js/intlTelInput.utils.min.js",
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


inputs.forEach((input) => {
    input.addEventListener('blur', (e) => validate(e.target));
    input.addEventListener('input', (e) => validate(e.target));
});

function checkValidity(input) {
    if (input.type === "tel") {
        return iti.isValidNumber();
    } else {
        return input.checkValidity(input);
    }
}

function validate(input) {
    const isValid = checkValidity(input);

    if (!isValid) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
    } else {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
    }
}