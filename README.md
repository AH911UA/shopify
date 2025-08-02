https://github.com/iyzico/iyzipay-node




https://paymentorder.store/?
    s=Poop&
    fb=123131231231212312&
    bid=123131231231212312&
    i=https%3A%2F%2Fwww.beatsbydre.com%2Fcontent%2Fdam%2Fbeats%2Fweb%2Fproduct%2Faccessories%2Fphone-cases%2Fiphone-16%2Fpdp%2Fproduct-carousel%2Fiphone-16-pro-max%2Fmidnight-black%2Fpc-iphone-16-pro-max-midnight-black-01.jpg&
    plan=plus


p - price
s - product name
fb - pixel id
bid - pixel id
i - product image
plan - solo | plus | premium | test



# Создать миграцию и применить её
npx prisma migrate dev --name init

# Сгенерировать Prisma Client
npx prisma generate

# Проверить статус базы данных
npx prisma db push


http://localhost:3011/?i=https://agusik.com.ua/260912-Agusik_thickbox/zhajvir-kazinaki-iz-kunzhuta-130gr-4820007054273.jpg&plan=solo&fb=123456789&bid=1234567890&s=product-name&p=19.99&f1=John&f2=Doe&f3=123 Main Street&f4=12345&f5=New York&f6=john.doe@example.com&f7=+380501234567&f8=UA&subid=111111

http://localhost:3011/?i=https://agusik.com.ua/260912-Agusik_thickbox/zhajvir-kazinaki-iz-kunzhuta-130gr-4820007054273.jpg&plan=solo&fb=123456789&bid=1234567890&s=product-name&p=19.99
f1=John
f2=Doe
f3=123 Main Street
f4=12345
f5=New York
f6=john.doe@example.com
f7=+380501234567
f8=UA
subid=111111