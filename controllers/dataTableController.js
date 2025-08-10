const { PrismaClient } = require('@prisma/client');

class DataTableController {
    static async getMaterialData(req, res) {
        try {
            const prisma = new PrismaClient();
            
            const PLAN_PRICE_MAP = {
                test: 0.01,
                solo: 9.99,
                plus: 19.99,
                premium: 19.99,
            };
            const getPlanPrice = (plan) => {
                const key = (plan || '').toString().toLowerCase();
                return PLAN_PRICE_MAP[key] ?? 0;
            };
            
            const getRecurringPrice = (plan) => {
                const key = (plan || '').toString().toLowerCase();
                const RECURRING_PRICE_MAP = {
                    test: 0.01,
                    solo: 19.99,
                    plus: 29.99,
                    premium: 39.99,
                };
                return RECURRING_PRICE_MAP[key] ?? 0;
            };
            
            // Получаем все платежи из базы данных с сортировкой по дате создания
            let payments = await prisma.payment.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    id: true,
                    bid: true,
                    createdAt: true,
                    plan: true,
                    firstName: true,
                    lastName: true,
                    countryCode: true,
                    email: true,
                    phone: true,
                    userHash: true,
                    locale: true,
                    rebillLog: true
                }
            });
            
            // Enrich with computed prices
            payments = payments.map((p) => {
                const paid = getPlanPrice(p.plan);
                const recurring = getRecurringPrice(p.plan);
                return {
                    ...p,
                    paidPrice: paid,
                    recurringPrice: recurring,
                };
            });
            
            // Определяем количество повторных колонок на основе реальных данных
            const MIN_RECURRING_COLUMNS = 6;
            let maxRecurring = MIN_RECURRING_COLUMNS;
            
            // Находим максимальное количество реальных повторных платежей
            payments.forEach(p => {
                if (p.rebillLog) {
                    let rebillEntries = [];
                    
                    // rebillLog может быть как объектом, так и массивом
                    if (Array.isArray(p.rebillLog)) {
                        rebillEntries = p.rebillLog;
                    } else if (typeof p.rebillLog === 'object' && p.rebillLog !== null) {
                        // Если это объект, преобразуем его в массив
                        rebillEntries = [p.rebillLog];
                    }
                    
                    maxRecurring = Math.max(maxRecurring, rebillEntries.length);
                }
            });

            // Build per-row recurring entries array based on real data
            payments = payments.map(p => {
                const recurring = [];
                
                if (p.rebillLog) {
                    let rebillEntries = [];
                    
                    // rebillLog может быть как объектом, так и массивом
                    if (Array.isArray(p.rebillLog)) {
                        rebillEntries = p.rebillLog;
                    } else if (typeof p.rebillLog === 'object' && p.rebillLog !== null) {
                        // Если это объект, преобразуем его в массив
                        rebillEntries = [p.rebillLog];
                    }
                    
                    // Используем реальные данные из rebillLog
                    rebillEntries.forEach((logEntry, index) => {
                        const recurringEntry = {
                            amount: p.recurringPrice || 0,
                            date: new Date(logEntry.at),
                            status: logEntry.status || null,
                            error: logEntry.error?.message || logEntry.error?.code || null,
                        };
                        recurring.push(recurringEntry);
                    });
                }
                
                // Дополняем до минимального количества колонок пустыми записями
                while (recurring.length < maxRecurring) {
                    recurring.push({
                        amount: 0,
                        date: null,
                        status: null,
                        error: null,
                    });
                }
                
                return { ...p, recurring };
            });

            // Вычисляем статистику
            const totalPayments = payments.length;
            const totalRevenue = payments.reduce((sum, p) => sum + (p.paidPrice || 0), 0);
            
            const countries = [...new Set(payments.map(p => p.countryCode).filter(Boolean))];
            const uniqueCustomers = [...new Set(payments.map(p => p.email).filter(Boolean))];
            
            // Статистика по месяцам
            const monthlyStats = {};
            payments.forEach(payment => {
                const month = new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                if (!monthlyStats[month]) {
                    monthlyStats[month] = { count: 0, revenue: 0 };
                }
                monthlyStats[month].count++;
                monthlyStats[month].revenue += payment.paidPrice || 0;
            });
            
            // Передаем также карту цен для фронта на случай клиентских пересчетов
            const planPrices = PLAN_PRICE_MAP;
            
            await prisma.$disconnect();
            
            res.render("material", {
                payments,
                stats: {
                    totalPayments,
                    totalRevenue: totalRevenue.toFixed(2),
                    countries: countries.length,
                    uniqueCustomers: uniqueCustomers.length,
                    monthlyStats
                },
                planPrices,
                maxRecurring,
                locale: req.cookies.lang || "en"
            });
        } catch (error) {
            console.error("Error fetching material data:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    static async updatePayment(req, res) {
        try {
            const { id, field, value } = req.body;
            
            if (!id || !field || value === undefined) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const prisma = new PrismaClient();
            
            // Валидация полей
            const allowedFields = ['bid', 'firstName', 'lastName', 'email', 'phone', 'countryCode', 'plan', 'createdAt', 'customerName'];
            if (!allowedFields.includes(field)) {
                return res.status(400).json({ error: 'Invalid field' });
            }

            // Валидация значений
            let validatedValue = value;
            if (field === 'plan') {
                // Только числа и точка для цены
                if (!/^[\d.]+$/.test(value)) {
                    return res.status(400).json({ error: 'Price must contain only numbers and decimal point' });
                }
                validatedValue = parseFloat(value).toFixed(2);
            } else if (field === 'customerName') {
                const name = (value || '').trim();
                if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
                const parts = name.split(/\s+/);
                const first = parts.shift();
                const last = parts.join(' ');
                const updated = await prisma.payment.update({
                    where: { id },
                    data: { firstName: first, lastName: last },
                    select: {
                        id: true, bid: true, createdAt: true, plan: true, firstName: true, lastName: true,
                        countryCode: true, email: true, phone: true, userHash: true, locale: true
                    }
                });
                await prisma.$disconnect();
                return res.json({ success: true, data: updated });
            } else if (field === 'phone') {
                // Только цифры для телефона
                if (!/^[\d\s\-\+\(\)]+$/.test(value)) {
                    return res.status(400).json({ error: 'Phone must contain only numbers, spaces, and special characters' });
                }
            } else if (field === 'email') {
                // Валидация email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    return res.status(400).json({ error: 'Invalid email format' });
                }
            } else if (field === 'countryCode') {
                // Только буквы для кода страны
                if (!/^[A-Za-z]{2,3}$/.test(value)) {
                    return res.status(400).json({ error: 'Country code must be 2-3 letters' });
                }
                validatedValue = value.toUpperCase();
            } else if (field === 'createdAt') {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    return res.status(400).json({ error: 'Invalid date' });
                }
                validatedValue = date;
            } else {
                // Для остальных полей - только буквы, цифры и пробелы
                if (!/^[A-Za-z0-9\s]+$/.test(value)) {
                    return res.status(400).json({ error: 'Field must contain only letters, numbers, and spaces' });
                }
            }

            // Обновляем запись в БД
            const updatedPayment = await prisma.payment.update({
                where: { id },
                data: { [field]: validatedValue },
                select: {
                    id: true,
                    bid: true,
                    createdAt: true,
                    plan: true,
                    firstName: true,
                    lastName: true,
                    countryCode: true,
                    email: true,
                    phone: true,
                    userHash: true,
                    locale: true
                }
            });

            await prisma.$disconnect();
            
            res.json({ success: true, data: updatedPayment });
        } catch (error) {
            console.error("Error updating payment:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    static async exportCSV(req, res) {
        try {
            const prisma = new PrismaClient();

            // Карта цен по планам
            const PLAN_PRICE_MAP = {
                test: 0.01,
                solo: 9.99,
                plus: 19.99,
                premium: 19.99,
            };
            const getPlanPrice = (plan) => {
                const key = (plan || '').toString().toLowerCase();
                return PLAN_PRICE_MAP[key] ?? 0;
            };
            
            const getRecurringPrice = (plan) => {
                const key = (plan || '').toString().toLowerCase();
                const RECURRING_PRICE_MAP = {
                    test: 0.01,
                    solo: 19.99,
                    plus: 29.99,
                    premium: 39.99,
                };
                return RECURRING_PRICE_MAP[key] ?? 0;
            };

            // Получаем все платежи из базы данных
            let payments = await prisma.payment.findMany({
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    bid: true,
                    createdAt: true,
                    plan: true,
                    firstName: true,
                    lastName: true,
                    countryCode: true,
                    email: true,
                    phone: true,
                    userHash: true,
                    locale: true,
                    rebillLog: true,
                }
            });

            await prisma.$disconnect();

            // Збагащаем вычисленными полями
            payments = payments.map((p) => {
                const paid = getPlanPrice(p.plan);
                const recurring = getRecurringPrice(p.plan);
                return {
                    ...p,
                    paidPrice: paid,
                    recurringPrice: recurring,
                };
            });

            // Определяем количество повторных колонок на основе реальных данных
            const MIN_RECURRING_COLUMNS = 6;
            let maxRecurring = MIN_RECURRING_COLUMNS;
            
            // Находим максимальное количество реальных повторных платежей
            payments.forEach(p => {
                if (p.rebillLog) {
                    let rebillEntries = [];
                    
                    // rebillLog может быть как объектом, так и массивом
                    if (Array.isArray(p.rebillLog)) {
                        rebillEntries = p.rebillLog;
                    } else if (typeof p.rebillLog === 'object' && p.rebillLog !== null) {
                        // Если это объект, преобразуем его в массив
                        rebillEntries = [p.rebillLog];
                    }
                    
                    maxRecurring = Math.max(maxRecurring, rebillEntries.length);
                }
            });

            // Заголовки CSV
            const headers = [
                'BID',
                'Created Date',
                'Paid Price',
                'Customer Name',
                'GEO',
                'SUBSCR',
                'Subscription ID',
            ];
                    for (let i = 1; i <= maxRecurring; i += 1) {
            headers.push(`Повторный платеж №${i}`, 'Дата', 'Примечание');
        }

            const SEP = ';';
            const csvRows = [headers.join(SEP)];

            const formatDate = (d) => {
                if (!d) return '';
                const dt = new Date(d);
                if (Number.isNaN(dt.getTime())) return '';
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, '0');
                const dd = String(dt.getDate()).padStart(2, '0');
                const val = `${y}-${m}-${dd}`;
                return `="${val}"`;
            };

            const formatAmount = (n) => {
                const num = Number(n || 0);
                const val = num.toFixed(2).replace('.', ',');
                return `="${val}"`;
            };

            payments.forEach(p => {
                // Построим массив повторных платежей на основе реальных данных
                const recurring = [];
                
                if (p.rebillLog) {
                    let rebillEntries = [];
                    
                    // rebillLog может быть как объектом, так и массивом
                    if (Array.isArray(p.rebillLog)) {
                        rebillEntries = p.rebillLog;
                    } else if (typeof p.rebillLog === 'object' && p.rebillLog !== null) {
                        // Если это объект, преобразуем его в массив
                        rebillEntries = [p.rebillLog];
                    }
                    
                    // Используем реальные данные из rebillLog
                    rebillEntries.forEach((logEntry, index) => {
                        recurring.push({
                            amount: p.recurringPrice || 0,
                            date: new Date(logEntry.at),
                            status: logEntry.status || null,
                            error: logEntry.error?.message || logEntry.error?.code || null,
                        });
                    });
                }
                
                // Дополняем до максимального количества колонок пустыми записями
                while (recurring.length < maxRecurring) {
                    recurring.push({
                        amount: 0,
                        date: null,
                        status: null,
                        error: null,
                    });
                }

                const row = [
                    p.bid || '',
                    formatDate(p.createdAt),
                    formatAmount(p.paidPrice || 0),
                    `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                    p.countryCode || '',
                    (p.plan || '').toString().toLowerCase(),
                    p.id,
                ];

                recurring.forEach(r => {
                    const amountStr = r.status ? formatAmount(r.amount || 0) : '';
                    const dateStr = r.status ? formatDate(r.date) : '';
                    let noteStr = '';
                    if (r.status === 'success') noteStr = 'Successful';
                    else if (r.status === 'failure') noteStr = `Error: ${r.error || 'Failed'}`;
                    row.push(amountStr, dateStr, noteStr);
                });

                const escapedRow = row.map(value => {
                    const escaped = value.toString().replace(/"/g, '""');
                    return `"${escaped}"`;
                });
                csvRows.push(escapedRow.join(SEP));
            });

            const csvBody = csvRows.join('\n');
            // Кодируем в Windows-1251 для полной совместимости с Excel на RU
            const iconv = require('iconv-lite');
            const withSep = `sep=${SEP}\n` + csvBody;
            const buffer = iconv.encode(withSep, 'win1251');

            const ts = new Date();
            const dateStr = ts.toISOString().slice(0, 10);
            const timeStr = ts.toTimeString().slice(0, 8).replace(/:/g, '-');
            const fileName = `material_data_${dateStr}_${timeStr}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=windows-1251');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.send(buffer);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = DataTableController;
