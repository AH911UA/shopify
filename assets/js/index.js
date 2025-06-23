const phone = document.getElementById('intl-phone');
const form = document.getElementById('payment-form');
const inputs = form.querySelectorAll('input');

// Step elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const continueBtn = document.getElementById('continue-btn');
const backBtn = document.getElementById('back-btn');

// Progress indicator elements
const stepIndicator1 = document.getElementById('step-indicator-1');
const stepIndicator2 = document.getElementById('step-indicator-2');
const stepConnector = document.querySelector('.step-connector');

// Initialize step 1 as active
step1.classList.add('active');
step2.classList.remove('active');

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

// Step navigation functionality
continueBtn.addEventListener('click', function() {
    if (validateStep1()) {
        step1.classList.remove('active');
        step2.classList.add('active');
        
        // Update progress indicator
        stepIndicator1.classList.remove('active');
        stepIndicator1.classList.add('completed');
        stepIndicator2.classList.add('active');
        stepConnector.classList.add('completed');
        
        // Scroll to top of step 2
        step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

backBtn.addEventListener('click', function() {
    step2.classList.remove('active');
    step1.classList.add('active');
    
    // Update progress indicator
    stepIndicator1.classList.remove('completed');
    stepIndicator1.classList.add('active');
    stepIndicator2.classList.remove('active');
    stepConnector.classList.remove('completed');
    
    // Scroll to top of step 1
    step1.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Validation functions
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
            if (!input.checkValidity()) {
                input.classList.add('is-invalid');
                input.classList.remove('is-valid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
                input.classList.add('is-valid');
            }
        }
    });
    
    return isValid;
}

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