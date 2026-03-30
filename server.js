require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('@neondatabase/serverless');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. Inicialização do Banco de Dados em Nuvem (Neon Serverless)
// ==========================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Criar tabela se não existir (Executa apenas na primeira carga)
async function initDB() {
    if (!process.env.DATABASE_URL) {
        console.warn('⚠️ DATABASE_URL não configurada! A Vercel/Neon precisa dessa chave.');
        return;
    }
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS wishlists (
                id SERIAL PRIMARY KEY,
                store_id VARCHAR(50),
                customer_id VARCHAR(100),
                product_id VARCHAR(100),
                product_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Banco de dados Neon (Postgres) Serverless conectado e tabela verificada.');
    } catch (err) {
        console.error('Erro ao inicializar tabela:', err);
    }
}
initDB();

// ==========================================
// 2. Rotas do Aplicativo Frontend (Nuvemshop)
// ==========================================

// Ping para testar se a API está no ar
app.get('/v1/health', (req, res) => {
    res.json({ status: 'Online!', cloud: 'Vercel Serverless' });
});

// Ler os favoritos de um cliente
app.get('/v1/wishlist', async (req, res) => {
    const customer = req.query.customer;
    if (!customer) return res.status(400).json({ error: 'Customer is required' });

    try {
        const result = await pool.query(
            `SELECT product_data FROM wishlists WHERE customer_id = $1`, 
            [customer]
        );
        const items = result.rows.map(r => JSON.parse(r.product_data));
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Salvar um favorito
app.post('/v1/wishlist', async (req, res) => {
    const { customer_id, product } = req.body;
    if (!customer_id || !product) return res.status(400).json({ error: 'Customer e Product são obrigatórios' });

    const store_id = "gofersi-cloud"; // Identificador multi-tenant

    try {
        // Verifica se já existe para este cliente
        const check = await pool.query(
            `SELECT id FROM wishlists WHERE customer_id = $1 AND product_id = $2`, 
            [customer_id, String(product.id)]
        );
        if (check.rows.length > 0) {
            return res.json({ success: true, message: 'Já existe' });
        }
        
        // Insere se não existir
        const insert = await pool.query(
            `INSERT INTO wishlists (store_id, customer_id, product_id, product_data) VALUES ($1, $2, $3, $4) RETURNING id`, 
            [store_id, customer_id, String(product.id), JSON.stringify(product)]
        );
        res.json({ success: true, internal_id: insert.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remover um favorito
app.delete('/v1/wishlist', async (req, res) => {
    const { customer_id, product_id } = req.body;
    if (!customer_id || !product_id) return res.status(400).json({ error: 'Faltando campos obrigatórios' });

    try {
        const del = await pool.query(
            `DELETE FROM wishlists WHERE customer_id = $1 AND product_id = $2`, 
            [customer_id, String(product_id)]
        );
        res.json({ success: true, deleted: del.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. Exportação para Vercel (Importante Serverless)
// ==========================================
// A Vercel não inicializa o servidor escutando uma PORTA por padrão, ela exporta o App.
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 Gofersi Cloud API iniciada localmente na porta ${PORT}`);
    });
}
module.exports = app;
