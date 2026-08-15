document.addEventListener('DOMContentLoaded', () => {
    const btnGoogle = document.getElementById('btn-login-google');
    
    if(btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    // Redireciona para o app após o login
                    redirectTo: window.location.origin + '/app.html' 
                }
            });
            if (error) console.error("Erro no login:", error.message);
        });
    }

    // Se o usuário abrir a página de login mas já tiver uma sessão ativa,
    // manda ele direto para o app
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.location.href = 'app.html';
        }
    });
});