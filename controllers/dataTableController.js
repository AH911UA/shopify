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
            
            // Enrich with computed prices and demo placeholders
            payments = payments.map((p, index) => {
                const paid = getPlanPrice(p.plan);
                const demoFailure = !p.rebillLog && index % 3 === 0; // каждый 3-й как неуспешный
                return {
                    ...p,
                    paidPrice: paid,
                    recurringPrice: paid * 2,
                    demoStatus: p.rebillLog ? null : (demoFailure ? 'failure' : 'success'),
                    demoError: p.rebillLog ? null : (demoFailure ? 'Insufficient funds (demo)' : null),
                };
            });
            
            // Determine dynamic number of recurring columns based on data (elapsed cycles since createdAt)
            const MS30 = 30 * 24 * 60 * 60 * 1000;
            const MIN_RECURRING_COLUMNS = 6; // показываем минимум столько колонок
            const now = new Date();
            let maxRecurring = 0;
            payments.forEach(p => {
                const created = new Date(p.createdAt);
                const cycles = Math.max(0, Math.floor((now.getTime() - created.getTime()) / MS30));
                if (cycles > maxRecurring) maxRecurring = cycles;
            });
            // минимум
            maxRecurring = Math.max(maxRecurring, MIN_RECURRING_COLUMNS);

            // Build per-row recurring entries array of length maxRecurring
            payments = payments.map(p => {
                const base = new Date(p.createdAt);
                const rowStatus = (p.rebillLog && p.rebillLog.status) || p.demoStatus; // success/failure
                const firstSuccess = rowStatus === 'success';
                const recurring = Array.from({ length: maxRecurring }, (_, i) => {
                    const date = new Date(base.getTime() + (i + 1) * MS30);
                    let status = null;
                    if (i === 0) status = rowStatus || null;
                    else if (firstSuccess) status = 'success';
                    return {
                        amount: p.recurringPrice || 0,
                        date,
                        status,
                        error: i === 0 ? (p.rebillLog?.error?.message || p.demoError || p.rebillLog?.error?.code || null) : null,
                    };
                });
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

            // Збагащаем вычисленными полями и демо-значениями при отсутствии rebillLog
            payments = payments.map((p, index) => {
                const paid = getPlanPrice(p.plan);
                const demoFailure = !p.rebillLog && index % 3 === 0; // каждый 3-й как неуспешный
                return {
                    ...p,
                    paidPrice: paid,
                    recurringPrice: paid * 2,
                    demoStatus: p.rebillLog ? null : (demoFailure ? 'failure' : 'success'),
                    demoError: p.rebillLog ? null : (demoFailure ? 'Insufficient funds (demo)' : null),
                };
            });

            // Определяем количество повторных колонок (мин. 6)
            const MS30 = 30 * 24 * 60 * 60 * 1000;
            const MIN_RECURRING_COLUMNS = 6;
            const now = new Date();
            let maxRecurring = 0;
            payments.forEach(p => {
                const created = new Date(p.createdAt);
                const cycles = Math.max(0, Math.floor((now.getTime() - created.getTime()) / MS30));
                if (cycles > maxRecurring) maxRecurring = cycles;
            });
            maxRecurring = Math.max(maxRecurring, MIN_RECURRING_COLUMNS);

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
                // Построим массив повторных платежей для строки
                const base = new Date(p.createdAt);
                const rowStatus = (p.rebillLog && p.rebillLog.status) || p.demoStatus; // success/failure
                const firstSuccess = rowStatus === 'success';
                const recurring = Array.from({ length: maxRecurring }, (_, i) => {
                    const date = new Date(base.getTime() + (i + 1) * MS30);
                    let status = null;
                    if (i === 0) status = rowStatus || null;
                    else if (firstSuccess) status = 'success';
                    return {
                        amount: p.recurringPrice || 0,
                        date,
                        status,
                        error: i === 0 ? (p.rebillLog?.error?.message || p.demoError || p.rebillLog?.error?.code || null) : null,
                    };
                });

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
