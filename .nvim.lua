vim.g.startify_disable_at_vimenter = 1
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true

-- ALEFix Config
vim.g.ale_fixers = {
	typescript = { "oxfmt" },
	javascript = { "oxfmt" },
	typescriptreact = { "oxfmt" },
	javascriptreact = { "oxfmt" },
	json = { "oxfmt" },
	jsonc = { "oxfmt" },
	-- css = { "oxfmt" },
	markdown = { "oxfmt" },
	-- html = { "oxfmt" },
	-- mdx = { "oxfmt" },
	conf = { "oxfmt" },
	-- lua = { "stylua" },
}
vim.g.ale_fix_on_save = 1

print("git-gw .nvim.lua has been sourced")
