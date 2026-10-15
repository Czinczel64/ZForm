# ZForm: roteiro de produto

ZForm é um projeto original de código aberto, com interface e implementação próprias. A meta é cobrir gradualmente os fluxos de uma suíte profissional de escultura 3D, sem copiar marca, código, interface ou recursos proprietários. Uma suíte desse porte não cabe em uma única alteração: o roteiro abaixo organiza entregas que podem ser construídas e verificadas em etapas.

## Estado atual

- Escultura direta: desenhar, suavizar, mover, inflar, achatar, argila, vinco e pinçar.
- Máscara por vértice, proteção de pintura/escultura, preenchimento de cor e pintura de vértice.
- Simetria X, desfazer/refazer, refinamento simples e navegação com Alt + arrastar.
- Um objeto editável por vez; formatos OBJ/STL/GLB com limitações descritas no README.
- Salvamento automático local de um estudo no navegador.

## Próximas etapas

1. **Fundação de malha e escultura:** malhas de alta densidade com orçamento de memória, níveis de subdivisão, remalhagem, operações booleanas, topologia e validação de malhas para impressão.
2. **Projeto e cena:** múltiplos objetos, visibilidade/isolamento, organização, transformações, duplicação, primitivas e arquivo de projeto nativo com vários estudos locais.
3. **Camadas e máscaras:** camadas não destrutivas de escultura e cor, máscaras graduais com operações, seleção e restauração de regiões.
4. **Pincéis:** biblioteca original de pincéis ajustáveis, estabilização do traço, pressão de mesa digitalizadora, alphas próprios, curvas de queda e atalhos configuráveis.
5. **Pintura e materiais:** pintura por textura, UVs, exportação de mapas, materiais editáveis, iluminação de visualização e gerenciamento de cores.
6. **Apresentação:** câmera, luzes, fundos e renderização com opções de qualidade compatíveis com máquinas de entrada.
7. **Interoperabilidade e distribuição:** formatos e importadores adicionais, plug-ins/automação, acessibilidade, instaladores desktop e documentação comunitária.

## Critérios de evolução

Cada etapa deve ter fluxo principal utilizável, persistência ou exportação quando aplicável, limite de memória explícito, interface acessível, documentação e verificação em navegador. Alvos de desempenho, incluindo 4 GB de VRAM, só serão declarados após medições em hardware correspondente.

As áreas do roteiro refletem categorias amplas descritas na documentação pública do setor: escultura, organização de objetos, camadas, pintura/texturização, renderização e pipeline. Referências: [documentação de escultura](https://help.maxon.net/zbr/en-us/Content/html/features/main-features/sculpting/sculpting.html), [recursos de pintura e produção](https://www.maxon.net/en/product-detail/zbrush/features) e [renderização](https://help.maxon.net/zbr/en-us/Content/html/features/main-features/rendering/rendering.html).
